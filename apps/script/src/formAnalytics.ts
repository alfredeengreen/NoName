import { batch } from './batch';

interface FormFieldState {
  formId: string;
  fieldName: string;
  focusTime: number;
  blurTime: number | null;
  errorCount: number;
}

// Track form field interactions
const formFields = new Map<string, FormFieldState>();

// Get form identifier
function getFormId(form: HTMLFormElement): string {
  return form.id || form.name || form.getAttribute('data-form-id') || `form_${form.action || window.location.pathname}`;
}

// Track form field focus
function trackFieldFocus(form: HTMLFormElement, field: HTMLElement) {
  const formId = getFormId(form);
  const fieldName = (field as HTMLInputElement).name || (field as HTMLInputElement).id || 'unknown';
  const key = `${formId}_${fieldName}`;
  
  formFields.set(key, {
    formId,
    fieldName,
    focusTime: Date.now(),
    blurTime: null,
    errorCount: 0,
  });
  
  batch.sendEvent('form_field', {
    formId,
    fieldName,
    eventType: 'focus',
  });
}

// Track form field blur
function trackFieldBlur(form: HTMLFormElement, field: HTMLElement) {
  const formId = getFormId(form);
  const fieldName = (field as HTMLInputElement).name || (field as HTMLInputElement).id || 'unknown';
  const key = `${formId}_${fieldName}`;
  
  const state = formFields.get(key);
  if (state) {
    const timeSpent = Math.round((Date.now() - state.focusTime) / 1000);
    
    batch.sendEvent('form_field', {
      formId,
      fieldName,
      eventType: 'blur',
      timeSpent,
      errorCount: state.errorCount,
    });
    
    formFields.delete(key);
  }
}

// Track form field change
function trackFieldChange(form: HTMLFormElement, field: HTMLElement) {
  const formId = getFormId(form);
  const fieldName = (field as HTMLInputElement).name || (field as HTMLInputElement).id || 'unknown';
  
  batch.sendEvent('form_field', {
    formId,
    fieldName,
    eventType: 'change',
  });
}

// Track form validation errors
function trackFieldError(form: HTMLFormElement, field: HTMLElement) {
  const formId = getFormId(form);
  const fieldName = (field as HTMLInputElement).name || (field as HTMLInputElement).id || 'unknown';
  const key = `${formId}_${fieldName}`;
  
  const state = formFields.get(key);
  if (state) {
    state.errorCount++;
  } else {
    formFields.set(key, {
      formId,
      fieldName,
      focusTime: Date.now(),
      blurTime: null,
      errorCount: 1,
    });
  }
  
  batch.sendEvent('form_field', {
    formId,
    fieldName,
    eventType: 'error',
    errorCount: state ? state.errorCount : 1,
  });
}

// Track form submission
function trackFormSubmit(form: HTMLFormElement) {
  const formId = getFormId(form);
  
  batch.sendEvent('form_field', {
    formId,
    eventType: 'submit',
  });
  
  // Clear all fields for this form
  Array.from(formFields.keys()).forEach(key => {
    if (formFields.get(key)?.formId === formId) {
      formFields.delete(key);
    }
  });
}

// Track form abandonment (when user leaves page with focused form)
function trackFormAbandonment() {
  const now = Date.now();
  
  formFields.forEach((state, key) => {
    // If field was focused more than 5 seconds ago and not blurred, consider it abandoned
    if (now - state.focusTime > 5000) {
      const timeSpent = Math.round((now - state.focusTime) / 1000);
      
      batch.sendEvent('form_field', {
        formId: state.formId,
        fieldName: state.fieldName,
        eventType: 'abandon',
        timeSpent,
        errorCount: state.errorCount,
      });
      
      formFields.delete(key);
    }
  });
}

// Initialize form analytics
export function setupFormAnalytics() {
  // Track form field focus
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    const form = target.closest('form') as HTMLFormElement;
    if (form && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      trackFieldFocus(form, target);
    }
  }, true);
  
  // Track form field blur
  document.addEventListener('focusout', (e) => {
    const target = e.target as HTMLElement;
    const form = target.closest('form') as HTMLFormElement;
    if (form && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      trackFieldBlur(form, target);
    }
  }, true);
  
  // Track form field changes
  document.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    const form = target.closest('form') as HTMLFormElement;
    if (form && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      trackFieldChange(form, target);
    }
  }, true);
  
  // Track form validation errors
  document.addEventListener('invalid', (e) => {
    const target = e.target as HTMLElement;
    const form = target.closest('form') as HTMLFormElement;
    if (form && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      trackFieldError(form, target);
    }
  }, true);
  
  // Track form submission
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.tagName === 'FORM') {
      trackFormSubmit(form);
    }
  }, true);
  
  // Track form abandonment on page unload
  window.addEventListener('beforeunload', trackFormAbandonment);
  window.addEventListener('pagehide', trackFormAbandonment);
  
  // Periodic abandonment check (every 10 seconds)
  setInterval(trackFormAbandonment, 10000);
}



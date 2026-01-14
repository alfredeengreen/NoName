// Copy and paste this entire script into the browser console on converdiant.com
// This will help us debug why localStorage isn't populating

console.log('=== Starting Manual Initialization Test ===');

// Step 1: Check if script loaded
console.log('1. Checking if script loaded...');
console.log('   typeof aa:', typeof aa);
console.log('   typeof aa.init:', typeof aa.init);
console.log('   aa object:', aa);

// Step 2: Check localStorage before init
console.log('\n2. Checking localStorage BEFORE init...');
console.log('   _aa_vid:', localStorage.getItem('_aa_vid'));
console.log('   _aa_sess:', localStorage.getItem('_aa_sess'));

// Step 3: Try to initialize
console.log('\n3. Attempting initialization...');
try {
  if (typeof aa !== 'undefined' && typeof aa.init === 'function') {
    console.log('   ✓ aa.init is available, calling it...');
    aa.init({
      siteId: '1VJwgIl8pEwV',
      key: 'QXE2i7kc5507qAT4NRylH-hEWxnZD6ur',
      endpoint: 'https://noname.fyi/collector',
      webApiUrl: 'https://noname.fyi'
    });
    console.log('   ✓ aa.init() called successfully');
  } else {
    console.log('   ✗ aa.init not available');
    console.log('   Trying queue pattern...');
    if (typeof aa !== 'undefined') {
      aa('init', {
        siteId: '1VJwgIl8pEwV',
        key: 'QXE2i7kc5507qAT4NRylH-hEWxnZD6ur',
        endpoint: 'https://noname.fyi/collector',
        webApiUrl: 'https://noname.fyi'
      });
      console.log('   ✓ Queue pattern called');
    }
  }
} catch (error) {
  console.error('   ✗ Error during initialization:', error);
}

// Step 4: Wait and check localStorage after init
setTimeout(function() {
  console.log('\n4. Checking localStorage AFTER init (1 second delay)...');
  console.log('   _aa_vid:', localStorage.getItem('_aa_vid'));
  console.log('   _aa_sess:', localStorage.getItem('_aa_sess'));
  
  if (!localStorage.getItem('_aa_vid')) {
    console.log('\n   ✗ localStorage still empty!');
    console.log('   Checking for errors...');
    
    // Check if localStorage is available
    try {
      localStorage.setItem('_test', 'test');
      localStorage.removeItem('_test');
      console.log('   ✓ localStorage is accessible');
    } catch (e) {
      console.error('   ✗ localStorage is blocked:', e);
    }
    
    // Check if init function exists and what it does
    if (typeof aa !== 'undefined' && typeof aa.init === 'function') {
      console.log('   aa.init function exists, checking its source...');
      console.log('   aa.init.toString():', aa.init.toString().substring(0, 200));
    }
  } else {
    console.log('\n   ✓ localStorage populated successfully!');
  }
  
  console.log('\n=== Test Complete ===');
}, 1000);



import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserOrgs } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgs = await getUserOrgs(user.id);
    return NextResponse.json({ orgs });
  } catch (error) {
    console.error('Error fetching orgs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



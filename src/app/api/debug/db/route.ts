import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  const url = process.env.TURSO_CONNECTION_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !token) {
    return NextResponse.json({ 
      error: 'Missing Turso credentials',
      url: url ? 'SET' : 'NOT SET',
      token: token ? 'SET' : 'NOT SET'
    }, { status: 500 });
  }

  const client = createClient({ url, authToken: token });
  
  try {
    // Check if verification table exists
    const verificationCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='verification'
    `);
    
    // List all tables
    const allTables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    return NextResponse.json({
      database: url.substring(0, 40) + '...',
      verificationExists: verificationCheck.rows.length > 0,
      totalTables: allTables.rows.length,
      tables: allTables.rows.map(r => r.name)
    });
    
  } catch (err) {
    return NextResponse.json({ 
      error: 'Database connection failed',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    client.close();
  }
}

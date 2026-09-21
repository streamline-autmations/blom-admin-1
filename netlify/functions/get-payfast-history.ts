import type { Handler } from "@netlify/functions";
import crypto from 'crypto';
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: 'Method Not Allowed' })
    };
  }

  try {
    const { method = 'monthly' } = event.queryStringParameters || {};

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const passphrase = process.env.PAYFAST_PASSPHRASE;

    if (!merchantId || !passphrase) {
      throw new Error('Missing PayFast credentials');
    }

    // Generate timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/\.\d{3}Z$/, '+02:00');

    let url: string;
    let signatureObj: any = {
      'merchant-id': merchantId,
      'passphrase': passphrase,
      'timestamp': timestamp,
      'version': 'v1'
    };

    // METHOD 1: Specific date range (from-to)
    if (method === 'range') {
      const { from, to } = event.queryStringParameters || {};
      if (from) signatureObj['from'] = from;
      if (to) signatureObj['to'] = to;

      url = 'https://api.payfast.co.za/transactions/history';
      if (from && to) {
        url += `?from=${from}&to=${to}`;
      }
    }
    // METHOD 2: Monthly (default - gets current month or specified month)
    else if (method === 'monthly') {
      const { date } = event.queryStringParameters || {};
      const monthDate = date || now.toISOString().slice(0, 7); // YYYY-MM format

      signatureObj['date'] = monthDate;
      url = `https://api.payfast.co.za/transactions/history/monthly?date=${monthDate}`;
    }
    // METHOD 3: Daily
    else if (method === 'daily') {
      const { date } = event.queryStringParameters || {};
      const dayDate = date || now.toISOString().slice(0, 10); // YYYY-MM-DD format

      signatureObj['date'] = dayDate;
      url = `https://api.payfast.co.za/transactions/history/daily?date=${dayDate}`;
    }
    // METHOD 4: Weekly
    else if (method === 'weekly') {
      const { date } = event.queryStringParameters || {};
      const weekDate = date || now.toISOString().slice(0, 10); // YYYY-MM-DD format

      signatureObj['date'] = weekDate;
      url = `https://api.payfast.co.za/transactions/history/weekly?date=${weekDate}`;
    } else {
      throw new Error('Invalid method. Use: range, monthly, daily, or weekly');
    }

    // Generate signature
    const sortedKeys = Object.keys(signatureObj).sort();
    const paramString = sortedKeys
      .map(key => `${key}=${encodeURIComponent(signatureObj[key])}`)
      .join('&');

    const signature = crypto.createHash('md5').update(paramString).digest('hex');

    console.log('PayFast Request:', {
      method,
      url,
      merchantId,
      timestamp,
      signature: signature.substring(0, 10) + '...'
    });

    // Make request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'merchant-id': merchantId,
        'version': 'v1',
        'timestamp': timestamp,
        'signature': signature
      }
    });

    const responseText = await response.text();

    console.log('PayFast Response Status:', response.status);
    console.log('PayFast Response Preview:', responseText.substring(0, 300));

    if (!response.ok) {
      console.error('PayFast Error:', responseText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          ok: false,
          error: `PayFast API Error (${response.status}): ${responseText}`
        })
      };
    }

    // Parse CSV
    const transactions = parseCSV(responseText);

    console.log('Parsed transactions count:', transactions.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, data: transactions })
    };

  } catch (error: any) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};

// CSV parser
function parseCSV(csv: string): any[] {
  if (!csv || csv.trim().length === 0) return [];

  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Get headers
  const headerLine = lines[0].replace(/^"|"$/g, '');
  const headers = headerLine.split('","').map(h => h.trim());

  const result: any[] = [];

  // Parse data lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '""') continue;

    const cleanLine = line.replace(/^"|"$/g, '');
    const values = cleanLine.split('","');

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').replace(/"/g, '');
    });

    result.push(row);
  }

  return result;
}

export const handler = withAdminAuth(baseHandler);

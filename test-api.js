import http from 'http';

const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING INTEGRATION TESTS ---');

  // 1. Health check
  const health = await request('/api/health');
  console.log('1. Health check:', health.status, health.data.status);
  if (health.status !== 200) throw new Error('Health check failed');

  // 2. Login
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@astrader.com', password: 'admin123@password' },
  });
  console.log('2. Admin Login:', loginRes.status, loginRes.data.success ? 'SUCCESS' : 'FAILED');
  const token = loginRes.data.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 3. Get Products
  const productsRes = await request('/api/products', { headers: authHeaders });
  console.log('3. Products Count:', productsRes.data.data.length, 'Total stock:', productsRes.data.summary.totalStock);
  const testProduct = productsRes.data.data[0];
  console.log(`   Selected Test Product: "${testProduct.productName}" | Stock: ${testProduct.currentStock} | Price: PKR ${testProduct.sellingPrice} | Cost: PKR ${testProduct.purchasePrice}`);

  // 4. Check Current Session
  const sessionRes = await request('/api/sessions/current', { headers: authHeaders });
  console.log('4. Business Session:', sessionRes.data.currentBusinessDate, 'Status:', sessionRes.data.isOpen ? 'OPEN' : 'CLOSED');

  // 5. Complete a POS Sale
  const initialStock = testProduct.currentStock;
  const saleQty = 5;
  const saleRes = await request('/api/sales', {
    method: 'POST',
    headers: authHeaders,
    body: {
      items: [
        {
          productId: testProduct._id,
          quantity: saleQty,
          sellingPrice: testProduct.sellingPrice,
        },
      ],
      paymentMethod: 'Cash',
      customerName: 'Chaudhry Akram',
      customerPhone: '0300-9876543',
    },
  });
  console.log('5. POS Sale:', saleRes.status, 'Invoice:', saleRes.data.data?.invoiceNumber, 'Total:', saleRes.data.data?.totalAmount, 'Profit:', saleRes.data.data?.totalProfit);
  if (saleRes.status !== 201) throw new Error('POS Sale failed: ' + JSON.stringify(saleRes.data));

  // Verify stock deduction
  const prodAfterSale = await request(`/api/products/${testProduct._id}`, { headers: authHeaders });
  console.log(`   Stock after sale: ${prodAfterSale.data.data.currentStock} (Expected: ${initialStock - saleQty})`);
  if (prodAfterSale.data.data.currentStock !== initialStock - saleQty) {
    throw new Error('Stock deduction mismatch!');
  }

  // 6. Test Dashboard Summary
  const dashRes = await request('/api/dashboard/summary', { headers: authHeaders });
  console.log('6. Dashboard Summary Today Sales:', dashRes.data.data.cards.todaySales, 'Today Profit:', dashRes.data.data.cards.todayProfit);

  // 7. Record Stock Purchase
  const purchaseRes = await request('/api/purchases', {
    method: 'POST',
    headers: authHeaders,
    body: {
      productId: testProduct._id,
      quantity: 50,
      purchasePrice: 4310,
      supplier: 'Fauji Fertilizer Depot Multan',
      notes: 'Fresh lot receiving',
    },
  });
  console.log('7. Stock Purchase:', purchaseRes.status, purchaseRes.data.message);

  // 8. Check Inventory History
  const historyRes = await request('/api/inventory/history', { headers: authHeaders });
  console.log('8. Inventory Movement History records:', historyRes.data.count);

  // 9. Check Daily Report
  const reportRes = await request('/api/reports/daily', { headers: authHeaders });
  console.log('9. Daily Report Total Sales:', reportRes.data.data.summary.totalSales, 'Profit:', reportRes.data.data.summary.grossProfit);

  // 10. Test Manual Day Close
  const closeRes = await request('/api/sessions/close', {
    method: 'POST',
    headers: authHeaders,
    body: { notes: 'Automated test reconciliation' },
  });
  console.log('10. Close Day:', closeRes.status, closeRes.data.message);

  // 11. Test that sale is PREVENTED when day is closed!
  const blockedSaleRes = await request('/api/sales', {
    method: 'POST',
    headers: authHeaders,
    body: {
      items: [
        {
          productId: testProduct._id,
          quantity: 1,
        },
      ],
    },
  });
  console.log('11. Sale after close prevented with code:', blockedSaleRes.status, '(Message:', blockedSaleRes.data.message, ')');
  if (blockedSaleRes.status !== 403) {
    throw new Error('Expected 403 Forbidden when day is closed, got: ' + blockedSaleRes.status);
  }

  // 12. Reopen Day
  const reopenRes = await request('/api/sessions/open', {
    method: 'POST',
    headers: authHeaders,
  });
  console.log('12. Reopened Business Session:', reopenRes.status, reopenRes.data.message);

  console.log('--- ALL BACKEND INTEGRATION TESTS PASSED PERFECTLY! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});


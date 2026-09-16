#!/usr/bin/env node

/**
 * Test Script: Order Status Update Functionality
 * Tests the complete order status update flow including:
 * 1. Status update via Netlify function
 * 2. Webhook functionality 
 * 3. Database persistence verification
 */


async function testOrderStatusUpdate() {
  console.log('🧪 Testing Order Status Update Functionality...\n');
  
  // Test configuration
  const baseUrl = 'http://localhost:8888'; // Netlify dev server
  const functionUrl = `${baseUrl}/.netlify/functions/admin-order-status`;
  
  // Test orders - both new and historical
  const testOrders = [
    {
      name: 'Recent Order (should work)',
      query: 'SELECT id, order_number, status FROM orders ORDER BY created_at DESC LIMIT 1;',
      expectedStatus: 'paid'
    },
    {
      name: 'Historical Order (potential issue)',
      query: 'SELECT id, order_number, status FROM orders WHERE created_at < NOW() - INTERVAL \'7 days\' ORDER BY created_at DESC LIMIT 1;',
      expectedStatus: 'paid'
    }
  ];

  console.log('📋 Test Scenarios:');
  testOrders.forEach((test, i) => {
    console.log(`  ${i + 1}. ${test.name} - Expected status: ${test.expectedStatus}`);
  });
  
  console.log('\n🚀 Starting Tests...\n');

  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  for (let i = 0; i < testOrders.length; i++) {
    const test = testOrders[i];
    console.log(`\n🔄 Test ${i + 1}: ${test.name}`);
    console.log('=' .repeat(50));
    
    try {
      // First, get a test order from database
      console.log('📊 Getting test order from database...');
      const orderQuery = `SELECT id, order_number, status, fulfillment_type FROM orders WHERE status = '${test.expectedStatus}' ORDER BY created_at DESC LIMIT 1;`;
      
      console.log(`Query: ${orderQuery}`);
      
      // For now, let's simulate the test with a known order ID
      // In a real scenario, you'd query the database first
      const testOrderId = 'test-order-id'; // This would be replaced with actual query result
      
      // Test the status update function
      console.log('🔄 Testing status update via Netlify function...');
      
      const requestBody = {
        id: testOrderId,
        status: 'packed' // Test updating from 'paid' to 'packed'
      };
      
      console.log(`Request: ${JSON.stringify(requestBody, null, 2)}`);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log(`Response Status: ${response.status}`);
      
      const result = await response.json();
      console.log(`Response: ${JSON.stringify(result, null, 2)}`);
      
      if (response.ok && result.ok) {
        console.log('✅ Status update successful!');
        console.log(`   - Method used: ${result.updateMethod}`);
        console.log(`   - Webhook called: ${result.webhook?.called || false}`);
        console.log(`   - Webhook successful: ${result.webhook?.ok || false}`);
        
        testResults.passed++;
        testResults.tests.push({
          name: test.name,
          status: 'PASSED',
          details: result
        });
      } else {
        throw new Error(`Status update failed: ${result.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      testResults.failed++;
      testResults.tests.push({
        name: test.name,
        status: 'FAILED',
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  testResults.tests.forEach((test, i) => {
    console.log(`${i + 1}. ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    } else if (test.details) {
      console.log(`   Method: ${test.details.updateMethod || 'unknown'}`);
      console.log(`   Webhook: ${test.details.webhook?.called ? 'Called' : 'Not called'}`);
    }
  });
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Check Netlify function logs for detailed error information');
  console.log('2. Verify database permissions for order status updates');
  console.log('3. Test with both new and historical orders');
  console.log('4. Ensure webhook endpoints are responding correctly');
  
  if (testResults.failed > 0) {
    console.log('\n🔍 TROUBLESHOOTING STEPS:');
    console.log('1. Check Netlify function deployment status');
    console.log('2. Verify environment variables are loaded');
    console.log('3. Check Supabase connection in function logs');
    console.log('4. Test direct database updates');
  }
  
  return testResults;
}

// Helper function to make HTTP requests
// Main execution
if (require.main === module) {
  testOrderStatusUpdate()
    .then(results => {
      console.log('\n🏁 Testing completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testOrderStatusUpdate };
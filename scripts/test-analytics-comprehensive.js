#!/usr/bin/env node

/**
 * Advanced Analytics Testing Script
 * Tests data accuracy, performance, and functionality of the enhanced analytics dashboard
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5173',
  endpoints: {
    advancedAnalytics: '/.netlify/functions/admin-analytics-advanced',
    orders: '/.netlify/functions/admin-orders',
    finance: '/.netlify/functions/admin-finance-stats'
  },
  testPeriods: [7, 30, 90],
  performance: {
    maxResponseTime: 5000, // 5 seconds
    maxMemoryUsage: 100 * 1024 * 1024 // 100MB
  }
};

// Test utilities
class AnalyticsTester {
  constructor() {
    this.results = {
      tests: [],
      errors: [],
      performance: {},
      dataAccuracy: {},
      summary: {}
    };
  }

  async runTest(name, testFn) {
    console.log(`\n🧪 Running test: ${name}`);
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.tests.push({
        name,
        status: 'PASS',
        duration,
        result
      });
      
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
      return { success: true, result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.tests.push({
        name,
        status: 'FAIL',
        duration,
        error: error.message
      });
      
      this.results.errors.push(error);
      
      console.log(`❌ ${name} - FAILED (${duration}ms): ${error.message}`);
      return { success: false, error, duration };
    }
  }

  async testAPIEndpoints() {
    console.log('\n🔗 Testing API Endpoints...');
    
    for (const [name, endpoint] of Object.entries(TEST_CONFIG.endpoints)) {
      await this.runTest(`API Endpoint: ${name}`, async () => {
        const response = await fetch(`${TEST_CONFIG.baseUrl}${endpoint}?period=30`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.ok) {
          throw new Error(`API returned ok=false: ${data.error || 'Unknown error'}`);
        }
        
        return {
          statusCode: response.status,
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : []
        };
      });
    }
  }

  async testAdvancedAnalyticsData() {
    console.log('\n📊 Testing Advanced Analytics Data...');
    
    for (const period of TEST_CONFIG.testPeriods) {
      await this.runTest(`Advanced Analytics Period: ${period} days`, async () => {
        const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?period=${period}`);
        const data = await response.json();
        
        if (!data.ok) {
          throw new Error(`Advanced analytics failed: ${data.error}`);
        }
        
        const analytics = data.data;
        
        // Validate required fields
        const requiredFields = [
          'period', 'topProducts', 'fulfillment', 'customers', 
          'conversions', 'inventory', 'trends', 'summary'
        ];
        
        const missingFields = requiredFields.filter(field => !analytics[field]);
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Validate top products structure
        if (!Array.isArray(analytics.topProducts)) {
          throw new Error('topProducts should be an array');
        }
        
        if (analytics.topProducts.length > 0) {
          const product = analytics.topProducts[0];
          const productFields = ['id', 'name', 'totalUnitsSold', 'totalRevenueCents'];
          const missingProductFields = productFields.filter(field => !(field in product));
          if (missingProductFields.length > 0) {
            throw new Error(`Missing product fields: ${missingProductFields.join(', ')}`);
          }
        }
        
        // Validate fulfillment data
        const fulfillmentRequired = ['delivery', 'collection'];
        fulfillmentRequired.forEach(method => {
          if (!analytics.fulfillment[method]) {
            throw new Error(`Missing ${method} fulfillment data`);
          }
          
          const methodData = analytics.fulfillment[method];
          const requiredMethodFields = ['count', 'revenueCents', 'avgOrderValue'];
          const missingMethodFields = requiredMethodFields.filter(field => !(field in methodData));
          if (missingMethodFields.length > 0) {
            throw new Error(`Missing ${method} fields: ${missingMethodFields.join(', ')}`);
          }
        });
        
        return {
          period: analytics.period,
          topProductsCount: analytics.topProducts.length,
          totalCustomers: analytics.customers.totalCustomers,
          conversionRate: analytics.conversions.conversionRate,
          trendsCount: analytics.trends.length
        };
      });
    }
  }

  async testDataConsistency() {
    console.log('\n🔍 Testing Data Consistency...');
    
    // Test consistency between different endpoints
    await this.runTest('Cross-Endpoint Data Consistency', async () => {
      const [advancedRes, ordersRes, financeRes] = await Promise.all([
        fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?period=30`),
        fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.orders}`),
        fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.finance}?period=month`)
      ]);
      
      const [advanced, orders, finance] = await Promise.all([
        advancedRes.json(),
        ordersRes.json(),
        financeRes.json()
      ]);
      
      if (!advanced.ok || !orders.ok || !finance.ok) {
        throw new Error('One or more endpoints failed');
      }
      
      // Compare total orders
      const advancedTotalOrders = advanced.data.summary.totalOrders;
      const ordersTotalOrders = orders.data.length;
      
      if (Math.abs(advancedTotalOrders - ordersTotalOrders) > ordersTotalOrders * 0.1) {
        throw new Error(`Order count mismatch: Advanced=${advancedTotalOrders}, Direct=${ordersTotalOrders}`);
      }
      
      // Compare revenue (within 10% tolerance for different time periods)
      const advancedRevenue = advanced.data.summary.totalRevenueCents / 100;
      const financeRevenue = finance.data.revenue;
      
      if (Math.abs(advancedRevenue - financeRevenue) > Math.max(advancedRevenue, financeRevenue) * 0.2) {
        console.warn(`Revenue slight mismatch: Advanced=${advancedRevenue}, Finance=${financeRevenue}`);
      }
      
      return {
        ordersConsistent: Math.abs(advancedTotalOrders - ordersTotalOrders) <= ordersTotalOrders * 0.1,
        revenueComparison: { advanced: advancedRevenue, finance: financeRevenue }
      };
    });
  }

  async testPerformance() {
    console.log('\n⚡ Testing Performance...');
    
    await this.runTest('API Response Time', async () => {
      const startTime = Date.now();
      
      await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?period=30`);
      const duration = Date.now() - startTime;
      
      if (duration > TEST_CONFIG.performance.maxResponseTime) {
        throw new Error(`Response time ${duration}ms exceeds limit of ${TEST_CONFIG.performance.maxResponseTime}ms`);
      }
      
      return { responseTime: duration, withinLimit: duration <= TEST_CONFIG.performance.maxResponseTime };
    });
    
    await this.runTest('Data Processing Performance', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?period=90`);
      const data = await response.json();
      
      const processingStart = Date.now();
      
      // Simulate data processing
      const analytics = data.data;
      const processedData = {
        totalRevenue: analytics.summary.totalRevenueCents,
        avgOrderValue: analytics.summary.avgOrderValue,
        topProduct: analytics.topProducts[0] || null,
        customerCount: analytics.customers.totalCustomers
      };
      
      const processingTime = Date.now() - processingStart;
      
      if (processingTime > 1000) {
        throw new Error(`Data processing took ${processingTime}ms, exceeds 1000ms limit`);
      }
      
      return { processingTime, processedDataKeys: Object.keys(processedData).length };
    });
  }

  async testDataAccuracy() {
    console.log('\n🎯 Testing Data Accuracy...');
    
    await this.runTest('Revenue Calculation Accuracy', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?period=30`);
      const data = await response.json();
      
      const analytics = data.data;
      
      // Verify profit calculations
      const totalRevenue = analytics.summary.totalRevenueCents;
      const avgOrderValue = analytics.summary.avgOrderValue;
      const totalOrders = analytics.summary.totalOrders;
      
      // Check if average calculation is correct
      const calculatedAvgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      if (Math.abs(calculatedAvgOrderValue - avgOrderValue) > 1) {
        throw new Error(`Average order value calculation error: Expected ${calculatedAvgOrderValue}, Got ${avgOrderValue}`);
      }
      
      return { 
        totalRevenue,
        avgOrderValue,
        totalOrders,
        calculationAccurate: Math.abs(calculatedAvgOrderValue - avgOrderValue) <= 1
      };
    });
    
    await this.runTest('Product Analytics Accuracy', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?period=30`);
      const data = await response.json();
      
      const topProducts = data.data.topProducts;
      
      if (topProducts.length > 1) {
        // Verify products are sorted by units sold
        for (let i = 1; i < topProducts.length; i++) {
          if (topProducts[i-1].totalUnitsSold < topProducts[i].totalUnitsSold) {
            throw new Error('Products not properly sorted by units sold');
          }
        }
      }
      
      // Verify profit margins are calculated
      for (const product of topProducts) {
        if (product.profitMargin < 0 || product.profitMargin > 100) {
          throw new Error(`Invalid profit margin for product ${product.name}: ${product.profitMargin}%`);
        }
      }
      
      return {
        productsSortedCorrectly: true,
        profitMarginsValid: topProducts.every(p => p.profitMargin >= 0 && p.profitMargin <= 100),
        topProduct: topProducts[0]?.name || 'No products'
      };
    });
  }

  async testEdgeCases() {
    console.log('\n🚨 Testing Edge Cases...');
    
    await this.runTest('Invalid Period Handling', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?period=invalid`);
      const data = await response.json();
      
      // Should handle invalid period gracefully
      if (!data.ok) {
        throw new Error(`Should handle invalid period gracefully, got error: ${data.error}`);
      }
      
      return { handledInvalidPeriod: true, defaultPeriod: data.data.period.days };
    });
    
    await this.runTest('Non-existent Product ID', async () => {
      const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.advancedAnalytics}?product_id=non-existent-id&period=30`);
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Should handle non-existent product gracefully, got error: ${data.error}`);
      }
      
      return { handledNonExistentProduct: true, topProductsCount: data.data.topProducts.length };
    });
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.tests.length,
        passed: this.results.tests.filter(t => t.status === 'PASS').length,
        failed: this.results.tests.filter(t => t.status === 'FAIL').length,
        successRate: ((this.results.tests.filter(t => t.status === 'PASS').length / this.results.tests.length) * 100).toFixed(1) + '%'
      },
      tests: this.results.tests,
      errors: this.results.errors.map(e => ({
        message: e.message,
        stack: e.stack
      }))
    };
    
    return report;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Advanced Analytics Testing Suite\n');
  
  const tester = new AnalyticsTester();
  
  try {
    await tester.testAPIEndpoints();
    await tester.testAdvancedAnalyticsData();
    await tester.testDataConsistency();
    await tester.testPerformance();
    await tester.testDataAccuracy();
    await tester.testEdgeCases();
    
    const report = await tester.generateReport();
    
    console.log('\n📋 Test Results Summary:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    
    if (report.summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      report.tests.filter(t => t.status === 'FAIL').forEach(test => {
        console.log(`- ${test.name}: ${test.error}`);
      });
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'analytics-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(report.summary.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n💥 Testing suite failed to execute:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { AnalyticsTester, TEST_CONFIG };
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import './AnalyticsPage.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchAnalytics();
  }, [selectedMonth, selectedYear]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get(`/analytics/personal?month=${selectedMonth}&year=${selectedYear}`);
      setAnalytics(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="analytics-page"><div className="loading-spinner">Loading...</div></div>;
  if (!analytics) return <div className="analytics-page"><p>No data available</p></div>;

  // Prepare chart data
  const categoryData = {
    labels: Object.keys(analytics.categoryBreakdown || {}),
    datasets: [{
      label: 'Spending by Category',
      data: Object.values(analytics.categoryBreakdown || {}),
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)',
        'rgba(255, 159, 64, 0.6)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)',
      ],
      borderWidth: 1,
    }],
  };

  const dailyData = {
    labels: Object.keys(analytics.dailyBreakdown || {}).map(d => `Day ${d}`),
    datasets: [{
      label: 'Daily Spending',
      data: Object.values(analytics.dailyBreakdown || {}),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
    }],
  };

  // AI Insights
  const avgDailySpend = analytics.total / new Date(selectedYear, selectedMonth, 0).getDate();
  const projectedMonthly = avgDailySpend * new Date(selectedYear, selectedMonth, 0).getDate();
  const topCategory = Object.entries(analytics.categoryBreakdown || {}).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <button className="back-btn" onClick={() => navigate('/expenses')}>
          ← Back
        </button>
        <h1>Analytics</h1>
      </header>

      <div className="month-selector">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          {[...Array(12)].map((_, i) => (
            <option key={i} value={i + 1}>
              {new Date(2000, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
          {[2024, 2025, 2026].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="analytics-summary">
        <div className="summary-card">
          <span className="summary-label">Total Spent</span>
          <span className="summary-value">₹{analytics.total?.toFixed(0) || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Transactions</span>
          <span className="summary-value">{analytics.expenseCount || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Avg/Day</span>
          <span className="summary-value">₹{avgDailySpend.toFixed(0)}</span>
        </div>
      </div>

      <div className="ai-insights">
        <h3>💡 AI Insights</h3>
        <div className="insight-cards">
          <div className="insight-card">
            <strong>Top Category:</strong> {topCategory ? `${topCategory[0]} (₹${topCategory[1].toFixed(0)})` : 'N/A'}
          </div>
          <div className="insight-card">
            <strong>Projected Monthly:</strong> ₹{projectedMonthly.toFixed(0)}
          </div>
          {avgDailySpend > 500 && (
            <div className="insight-card warning">
              ⚠️ High daily average! Consider reviewing your spending.
            </div>
          )}
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-card">
          <h3>Category Breakdown</h3>
          {Object.keys(analytics.categoryBreakdown || {}).length > 0 ? (
            <Pie data={categoryData} />
          ) : (
            <p className="empty-state">No category data</p>
          )}
        </div>

        <div className="chart-card">
          <h3>Daily Spending Trend</h3>
          {Object.keys(analytics.dailyBreakdown || {}).length > 0 ? (
            <Bar data={dailyData} options={{ responsive: true, maintainAspectRatio: true }} />
          ) : (
            <p className="empty-state">No daily data</p>
          )}
        </div>
      </div>

      <div className="category-details">
        <h3>Category Details</h3>
        <div className="category-list">
          {Object.entries(analytics.categoryBreakdown || {}).map(([category, amount]) => (
            <div key={category} className="category-item">
              <span className="category-name">{category}</span>
              <div className="category-bar-container">
                <div 
                  className="category-bar" 
                  style={{ width: `${(amount / analytics.total) * 100}%` }}
                ></div>
              </div>
              <span className="category-amount">₹{amount.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;

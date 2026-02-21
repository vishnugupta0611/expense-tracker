import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { Pie, Bar } from 'react-chartjs-2';
import './SpaceAnalyticsPage.css';

const SpaceAnalyticsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [space, setSpace] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [spaceRes, analyticsRes] = await Promise.all([
        api.get(`/spaces/${id}`),
        api.get(`/analytics/space/${id}`)
      ]);
      setSpace(spaceRes.data.space || spaceRes.data);
      setAnalytics(analyticsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="space-analytics-page"><div className="loading-spinner">Loading...</div></div>;
  if (!analytics || !space) return <div className="space-analytics-page"><p>No data available</p></div>;

  // Category breakdown chart
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
    }],
  };

  // Member contribution chart
  const memberData = {
    labels: Object.keys(analytics.memberContribution || {}).map(name => name.split(' ')[0]),
    datasets: [{
      label: 'Contribution by Member',
      data: Object.values(analytics.memberContribution || {}),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
    }],
  };

  // Calculate individual shares
  const totalSpent = analytics.total || 0;
  const memberCount = space.members.length;
  const equalShare = totalSpent / memberCount;

  return (
    <div className="space-analytics-page">
      <header className="analytics-header">
        <button className="back-btn" onClick={() => navigate(`/spaces/${id}`)}>
          ← Back to Space
        </button>
        <h1>{space.name} - Analytics</h1>
      </header>

      <div className="analytics-summary">
        <div className="summary-card">
          <span className="summary-label">Total Spent</span>
          <span className="summary-value">₹{totalSpent.toFixed(0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Budget</span>
          <span className="summary-value">₹{space.budgets?.monthly || 0}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Per Person</span>
          <span className="summary-value">₹{equalShare.toFixed(0)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Expenses</span>
          <span className="summary-value">{analytics.expenseCount || 0}</span>
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
          <h3>Member Contributions</h3>
          {Object.keys(analytics.memberContribution || {}).length > 0 ? (
            <Bar data={memberData} options={{ responsive: true }} />
          ) : (
            <p className="empty-state">No contribution data</p>
          )}
        </div>
      </div>

      <div className="member-breakdown">
        <h3>Individual Breakdown</h3>
        <div className="member-list">
          {Object.entries(analytics.memberContribution || {}).map(([memberName, paid]) => {
            const owes = equalShare - paid;
            const status = owes > 0 ? 'owes' : owes < 0 ? 'owed' : 'settled';
            
            return (
              <div key={memberName} className={`member-item ${status}`}>
                <div className="member-info">
                  <div className="member-avatar">{memberName[0]}</div>
                  <div className="member-details">
                    <span className="member-name">{memberName}</span>
                    <span className="member-paid">Paid: ₹{paid.toFixed(0)}</span>
                  </div>
                </div>
                <div className="member-balance">
                  {status === 'settled' && (
                    <span className="status-badge settled">✓ Settled</span>
                  )}
                  {status === 'owes' && (
                    <span className="status-badge owes">Owes ₹{Math.abs(owes).toFixed(0)}</span>
                  )}
                  {status === 'owed' && (
                    <span className="status-badge owed">Gets back ₹{Math.abs(owes).toFixed(0)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="category-details">
        <h3>Category Details</h3>
        <div className="category-list">
          {Object.entries(analytics.categoryBreakdown || {}).map(([category, amount]) => {
            const percentage = ((amount / totalSpent) * 100).toFixed(1);
            return (
              <div key={category} className="category-item">
                <span className="category-name">{category}</span>
                <div className="category-bar-container">
                  <div 
                    className="category-bar" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="category-amount">₹{amount.toFixed(0)} ({percentage}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SpaceAnalyticsPage;

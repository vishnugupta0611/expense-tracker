import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
  PointElement, LineElement, Filler,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import './AnalyticsPage.css';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
  PointElement, LineElement, Filler,
);

const CATEGORY_EMOJI = {
  Food: '🍕', Transport: '🚗', Bills: '💡',
  Grocery: '🛒', Entertainment: '🎬', Other: '📦',
};

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('overview'); // overview | trend | categories

  useEffect(() => {
    fetchAnalytics();
  }, [selectedMonth, selectedYear]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analytics/personal?month=${selectedMonth}&year=${selectedYear}`);
      setAnalytics(res.data);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    const now = new Date();
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const isCurrentMonth =
    selectedMonth === new Date().getMonth() + 1 &&
    selectedYear === new Date().getFullYear();

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-skeleton">
          <div className="sk-header" />
          <div className="sk-nav" />
          <div className="sk-cards" />
          <div className="sk-chart" />
        </div>
      </div>
    );
  }

  const breakdown = analytics?.categoryBreakdown || {};
  const daily = analytics?.dailyBreakdown || {};
  const total = analytics?.total || 0;
  const count = analytics?.expenseCount || 0;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const avgDaily = total / daysInMonth;
  const topCategory = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  const sortedCategories = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  // Doughnut chart
  const doughnutData = {
    labels: sortedCategories.map(([k]) => k),
    datasets: [{
      data: sortedCategories.map(([, v]) => v),
      backgroundColor: COLORS,
      borderWidth: 2,
      borderColor: 'var(--card-bg)',
      hoverOffset: 6,
    }],
  };
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ₹${ctx.parsed.toFixed(0)} (${((ctx.parsed / total) * 100).toFixed(1)}%)`,
        },
      },
    },
  };

  // Bar chart — only show days that have data, max 15 labels on mobile
  const dailyEntries = Object.entries(daily).sort((a, b) => Number(a[0]) - Number(b[0]));
  const barData = {
    labels: dailyEntries.map(([d]) => `${d}`),
    datasets: [{
      label: '₹',
      data: dailyEntries.map(([, v]) => v),
      backgroundColor: COLORS[0] + 'cc',
      borderRadius: 4,
      borderSkipped: false,
    }],
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` ₹${ctx.parsed.y.toFixed(0)}` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, maxRotation: 0 },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { size: 10 },
          callback: (v) => `₹${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`,
        },
      },
    },
  };

  return (
    <div className="analytics-page">
      {/* Header */}
      <header className="analytics-header">
        <button className="back-btn" onClick={() => navigate('/expenses')}>
          ←
        </button>
        <h1>Analytics</h1>
        <div className="header-spacer" />
      </header>

      {/* Month navigator */}
      <div className="month-nav">
        <button className="month-arrow" onClick={prevMonth}>‹</button>
        <div className="month-label">
          <span className="month-name">{MONTHS[selectedMonth - 1]}</span>
          <span className="month-year">{selectedYear}</span>
        </div>
        <button className="month-arrow" onClick={nextMonth} disabled={isCurrentMonth}>›</button>
      </div>

      {/* Summary strip */}
      <div className="summary-strip">
        <div className="strip-card">
          <span className="strip-label">Total</span>
          <span className="strip-value">₹{total.toFixed(0)}</span>
        </div>
        <div className="strip-divider" />
        <div className="strip-card">
          <span className="strip-label">Transactions</span>
          <span className="strip-value">{count}</span>
        </div>
        <div className="strip-divider" />
        <div className="strip-card">
          <span className="strip-label">Avg/Day</span>
          <span className="strip-value">₹{avgDaily.toFixed(0)}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {['overview', 'trend', 'categories'].map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? '📊 Overview' : tab === 'trend' ? '📈 Trend' : '🏷️ Categories'}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          {/* Insights */}
          <div className="insights-card">
            <div className="insights-title">💡 Insights</div>
            <div className="insights-grid">
              <div className="insight-item">
                <span className="insight-icon">🏆</span>
                <div>
                  <div className="insight-label">Top Category</div>
                  <div className="insight-val">{topCategory ? `${topCategory[0]}` : '—'}</div>
                </div>
                {topCategory && <span className="insight-amount">₹{topCategory[1].toFixed(0)}</span>}
              </div>
              <div className="insight-item">
                <span className="insight-icon">📅</span>
                <div>
                  <div className="insight-label">Projected Month</div>
                  <div className="insight-val">₹{(avgDaily * daysInMonth).toFixed(0)}</div>
                </div>
              </div>
              {avgDaily > 500 && (
                <div className="insight-item warning">
                  <span className="insight-icon">⚠️</span>
                  <div>
                    <div className="insight-label">High daily average</div>
                    <div className="insight-val">Consider reviewing spending</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Doughnut + legend */}
          {sortedCategories.length > 0 ? (
            <div className="donut-card">
              <div className="donut-title">Spending by Category</div>
              <div className="donut-wrap">
                <div className="donut-chart">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                  <div className="donut-center">
                    <span className="donut-total">₹{total >= 1000 ? (total / 1000).toFixed(1) + 'k' : total.toFixed(0)}</span>
                    <span className="donut-sub">total</span>
                  </div>
                </div>
                <div className="donut-legend">
                  {sortedCategories.map(([cat, amt], i) => (
                    <div key={cat} className="legend-row">
                      <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="legend-emoji">{CATEGORY_EMOJI[cat] || '🏷️'}</span>
                      <span className="legend-name">{cat}</span>
                      <span className="legend-pct">{((amt / total) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-card">No data for this month</div>
          )}
        </div>
      )}

      {/* ── Trend tab ── */}
      {activeTab === 'trend' && (
        <div className="tab-content">
          <div className="bar-card">
            <div className="bar-title">Daily Spending — {MONTHS[selectedMonth - 1]}</div>
            {dailyEntries.length > 0 ? (
              <div className="bar-wrap">
                <Bar data={barData} options={barOptions} />
              </div>
            ) : (
              <div className="empty-card">No daily data</div>
            )}
          </div>
        </div>
      )}

      {/* ── Categories tab ── */}
      {activeTab === 'categories' && (
        <div className="tab-content">
          <div className="cat-card">
            {sortedCategories.length === 0 ? (
              <div className="empty-card">No category data</div>
            ) : (
              sortedCategories.map(([cat, amt], i) => (
                <div key={cat} className="cat-row">
                  <div className="cat-left">
                    <span className="cat-emoji">{CATEGORY_EMOJI[cat] || '🏷️'}</span>
                    <span className="cat-name">{cat}</span>
                  </div>
                  <div className="cat-right">
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar-fill"
                        style={{
                          width: `${(amt / total) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <div className="cat-meta">
                      <span className="cat-amount">₹{amt.toFixed(0)}</span>
                      <span className="cat-pct">{((amt / total) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;

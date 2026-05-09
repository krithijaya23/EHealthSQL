import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Activity, AlertCircle, User, Stethoscope, Brain } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './HealthInsights.css';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#ef4444', '#0891b2', '#db2777', '#84cc16'];

const InsightCard = ({ icon: Icon, title, value, color, sub }) => (
  <div className="insight-stat card">
    <div className="insight-stat__icon" style={{ background: color + '18', color }}>
      <Icon size={20} />
    </div>
    <div>
      <p className="insight-stat__label">{title}</p>
      <p className="insight-stat__value">{value}</p>
      {sub && <p className="insight-stat__sub">{sub}</p>}
    </div>
  </div>
);

const HealthInsights = () => {
  const { sharedAccount } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = sharedAccount?._id ? { ownerUserId: sharedAccount._id } : {};
        const [analyticsRes, summaryRes] = await Promise.all([
          api.get('/analytics', { params }),
          api.get('/summary', { params }),
        ]);
        setAnalytics(analyticsRes.data.analytics);
        setSummary(summaryRes.data.summary);
      } catch {
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [sharedAccount]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="insights-page fade-in">
      <div className="page-header">
        <h1>Health Insights</h1>
        <p>Analytics and AI-powered health summary</p>
      </div>

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <InsightCard icon={Activity} title="Total Visits" value={analytics?.totalRecords || 0} color="#2563eb" sub="All time" />
        <InsightCard icon={TrendingUp} title="This Year" value={analytics?.monthlyVisits?.reduce((a, b) => a + b.count, 0) || 0} color="#7c3aed" sub="Records" />
        <InsightCard icon={AlertCircle} title="Diagnoses" value={analytics?.diagnosisDistribution?.length || 0} color="#f59e0b" sub="Unique" />
        <InsightCard icon={Brain} title="AI Insights" value={summary?.insights?.length || 0} color="#059669" sub="Generated" />
      </div>

      <div className="insights-grid">
        {/* Visit frequency line chart */}
        <div className="card insights-chart-card insights-chart-card--wide">
          <h3 className="insights-chart-title">Visit Frequency (Last 12 Months)</h3>
          {analytics?.monthlyVisits?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analytics.monthlyVisits} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }}
                  labelStyle={{ fontWeight: 700 }}
                />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} dot={{ fill: '#2563eb', r: 4 }} activeDot={{ r: 6 }} name="Visits" />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="insights-empty">No visit data available</div>}
        </div>

        {/* Diagnosis pie chart */}
        <div className="card insights-chart-card">
          <h3 className="insights-chart-title">Diagnosis Distribution</h3>
          {analytics?.diagnosisDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={analytics.diagnosisDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }) => `${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {analytics.diagnosisDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="insights-empty">No diagnosis data</div>}
        </div>

        {/* Hospital bar chart */}
        <div className="card insights-chart-card">
          <h3 className="insights-chart-title">Hospital Visit Frequency</h3>
          {analytics?.hospitalVisits?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.hospitalVisits} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-30} textAnchor="end" tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }} />
                <Bar dataKey="visits" fill="#7c3aed" radius={[6, 6, 0, 0]} name="Visits" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="insights-empty">No hospital data</div>}
        </div>

        {/* Record type distribution */}
        <div className="card insights-chart-card">
          <h3 className="insights-chart-title">Record Types</h3>
          {analytics?.recordTypeDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.recordTypeDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Count">
                  {analytics.recordTypeDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="insights-empty">No data</div>}
        </div>

        {/* AI Summary panel — redesigned */}
        {summary && (
          <div className="insights-ai-card insights-chart-card--wide">

            {/* Patient Summary */}
            <div className="card insights-summary-card">
              <div className="insights-summary-header">
                <div className="insights-summary-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <User size={20} />
                </div>
                <div>
                  <h3 className="insights-summary-title">Patient Summary</h3>
                  <p className="insights-summary-sub">Easy-to-understand overview of your health history</p>
                </div>
                <span className="badge badge-blue" style={{ fontSize: 11, flexShrink: 0 }}>
                  {summary.totalVisits} records
                </span>
              </div>
              <div className="insights-summary-body">
                {summary.patientSummary.split('\n\n').map((para, i) => (
                  <p key={i} className="insights-summary-para">{para}</p>
                ))}
              </div>
            </div>

            {/* Doctor Summary */}
            <div className="card insights-summary-card insights-summary-card--clinical">
              <div className="insights-summary-header">
                <div className="insights-summary-icon" style={{ background: '#faf5ff', color: '#7c3aed' }}>
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h3 className="insights-summary-title">Clinical Summary</h3>
                  <p className="insights-summary-sub">Medical review for healthcare professionals</p>
                </div>
                <span className="badge" style={{ background: '#faf5ff', color: '#7c3aed', fontSize: 11, flexShrink: 0 }}>
                  Clinical
                </span>
              </div>
              <div className="insights-summary-body">
                {summary.doctorSummary.split('\n\n').map((para, i) => {
                  // Render bullet lists properly
                  if (para.includes('\n•')) {
                    const [heading, ...items] = para.split('\n');
                    return (
                      <div key={i} className="insights-summary-section">
                        {heading && <p className="insights-summary-para">{heading}</p>}
                        <ul className="insights-summary-list">
                          {items.map((item, j) => (
                            <li key={j}>{item.replace(/^•\s*/, '')}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return <p key={i} className="insights-summary-para">{para}</p>;
                })}
              </div>
            </div>

            {/* Key highlights row */}
            <div className="insights-highlights-row">
              {summary.frequentDiagnoses?.length > 0 && (
                <div className="card insights-highlight-card">
                  <p className="insights-highlight-title">Frequent Diagnoses</p>
                  <div className="insights-highlight-tags">
                    {summary.frequentDiagnoses.map((d) => (
                      <span key={d.name} className="badge badge-blue" style={{ fontSize: 11 }}>
                        {d.name} <span style={{ opacity: .7 }}>×{d.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {summary.currentMedications?.length > 0 && (
                <div className="card insights-highlight-card">
                  <p className="insights-highlight-title">Common Medications</p>
                  <div className="insights-highlight-tags">
                    {summary.currentMedications.slice(0, 6).map((m) => (
                      <span key={m.name} className="badge badge-purple" style={{ fontSize: 11 }}>{m.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {summary.recentTrends?.length > 0 && (
                <div className="card insights-highlight-card">
                  <p className="insights-highlight-title">Health Trends</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {summary.recentTrends.map((t, i) => (
                      <div key={i} className="insights-ai-trend">
                        <TrendingUp size={13} />
                        <span style={{ fontSize: 13 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default HealthInsights;

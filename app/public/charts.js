// Analytics Charts Configuration

const chartColors = {
  primary: '#3b82f6',
  secondary: '#2563eb',
  accent: '#60a5fa',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899'
};

const chartState = {
  radar: null,
  doughnut: null,
  bar: null,
};

document.addEventListener('DOMContentLoaded', () => {
  initializeRadarChart();
  initializeDoughnutChart();
  initializeBarChart();

  // Keep the dashboard in sync if an analysis already exists.
  if (window.getAnalysisResult && window.getStartupIdeaContext) {
    const analysis = window.getAnalysisResult();
    if (analysis) {
      updateAnalyticsCharts(analysis, window.getStartupIdeaContext?.() || {});
    }
  }
});

function clampScore(value) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function textBlob(analysisData = {}, context = {}) {
  return [
    analysisData.marketDemand,
    analysisData.revenueModel,
    analysisData.suggestions,
    analysisData.raw,
    context.title,
    context.description,
    context.targetAudience,
  ]
    .map((value) => (typeof value === 'string' ? value : JSON.stringify(value || '')))
    .join(' ')
    .toLowerCase();
}

function scoreFromKeywords(text, keywords, base = 4, spread = 5) {
  const count = keywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0);
  return clampScore(base + count * spread / Math.max(1, keywords.length));
}

function deriveRadarScores(analysisData = {}, context = {}) {
  const text = textBlob(analysisData, context);
  const demand = analysisData.marketDemand ? scoreFromKeywords(String(analysisData.marketDemand).toLowerCase(), ['high', 'growing', 'demand', 'convenience', 'busy', 'trend'], 6, 4) : 5;
  const innovation = scoreFromKeywords(text, ['ai', 'smart', 'personalized', 'automation', 'predictive', 'integration', 'dynamic'], 4, 6);
  const scalability = scoreFromKeywords(text, ['subscription', 'platform', 'partnership', 'marketplace', 'scale', 'scalable', 'expansion'], 4, 6);
  const revenuePotential = scoreFromKeywords(String(analysisData.revenueModel || '').toLowerCase(), ['subscription', 'ads', 'commission', 'marketplace', 'delivery', 'fee', 'freemium', 'markup'], 4, 6);
  const competitionPressure = scoreFromKeywords(text, ['competition', 'competitive', 'competitors', 'crowded', 'incumbent', 'established'], 6, 4);
  const riskLevel = scoreFromKeywords(text, ['risk', 'logistics', 'thin margins', 'regulation', 'supply chain', 'cost'], 5, 5);

  return [innovation, demand, scalability, revenuePotential, competitionPressure, riskLevel];
}

function extractRevenueMix(analysisData = {}) {
  const text = String(analysisData.revenueModel || '').toLowerCase();
  const candidates = [
    { label: 'Subscription', keywords: ['subscription', 'membership'] },
    { label: 'Ads', keywords: ['ads', 'advertising', 'sponsored'] },
    { label: 'Marketplace', keywords: ['marketplace', 'commission', 'commission', 'partner stores', 'product sales'] },
    { label: 'Delivery Fees', keywords: ['delivery fee', 'delivery fees', 'shipping', 'service fee', 'service fees'] },
  ];

  const values = candidates.map(({ keywords }) => {
    const hitCount = keywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0);
    return hitCount;
  });

  const totalHits = values.reduce((sum, value) => sum + value, 0);
  if (totalHits === 0) {
    return { labels: ['Primary Revenue'], data: [100] };
  }

  return {
    labels: candidates.map((candidate) => candidate.label).filter((_, index) => values[index] > 0),
    data: values.filter((value) => value > 0).map((value) => Math.round((value / totalHits) * 100)),
  };
}

function detectCategory(text) {
  const rules = [
    { label: 'E-commerce', keywords: ['grocery', 'shop', 'buy online', 'delivery', 'marketplace', 'store'] },
    { label: 'AI/ML', keywords: ['ai', 'machine learning', 'predictive', 'smart', 'personalized'] },
    { label: 'EdTech', keywords: ['study', 'learning', 'quiz', 'course', 'student', 'education'] },
    { label: 'HealthTech', keywords: ['health', 'medical', 'vet', 'wellness', 'clinic', 'fitness'] },
    { label: 'FinTech', keywords: ['payment', 'finance', 'budget', 'bank', 'invoice'] },
    { label: 'SaaS', keywords: ['dashboard', 'workflow', 'subscription', 'platform', 'software'] },
  ];

  return rules
    .map((rule) => ({
      label: rule.label,
      score: rule.keywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
}

function initializeRadarChart() {
  const ctx = document.getElementById('radarChart').getContext('2d');
  chartState.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Innovation', 'Market Demand', 'Scalability', 'Revenue Potential', 'Competition Pressure', 'Risk Level'],
      datasets: [
        {
          label: 'No idea analyzed yet',
          data: [0, 0, 0, 0, 0, 0],
          borderColor: chartColors.primary,
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: chartColors.primary,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: chartColors.accent,
          tension: 0.3,
          fill: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#e5e7eb',
            font: { size: 14, weight: '600' },
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb',
          borderColor: chartColors.primary,
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label(context) {
              return `${context.label}: ${context.parsed.r}/10`;
            }
          }
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 10,
          min: 0,
          ticks: {
            color: '#94a3b8',
            font: { size: 12 },
            stepSize: 2
          },
          grid: {
            color: 'rgba(59, 130, 246, 0.1)',
            lineWidth: 1
          },
          pointLabels: {
            color: '#cbd5e1',
            font: { size: 13, weight: '600' },
            padding: 8
          }
        }
      },
      animation: {
        duration: 800,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function initializeDoughnutChart() {
  const ctx = document.getElementById('doughnutChart').getContext('2d');
  chartState.doughnut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['No analysis yet'],
      datasets: [
        {
          data: [100],
          backgroundColor: [chartColors.primary],
          borderColor: '#0f172a',
          borderWidth: 2,
          hoverOffset: 10
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#e5e7eb',
            font: { size: 13, weight: '600' },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb',
          borderColor: chartColors.primary,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total ? Math.round((value / total) * 100) : 0;
              return `${label}: ${value}% (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        duration: 800,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function initializeBarChart() {
  const ctx = document.getElementById('barChart').getContext('2d');
  chartState.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['No analysis yet'],
      datasets: [
        {
          label: 'Idea Category Fit',
          data: [0],
          backgroundColor: [chartColors.primary],
          borderRadius: 10,
          borderWidth: 0,
          hoverBackgroundColor: [`${chartColors.primary}dd`],
          hoverBorderRadius: 12,
          transition: {
            duration: 300
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#e5e7eb',
            font: { size: 14, weight: '600' },
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb',
          borderColor: chartColors.primary,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${context.parsed.y}% fit`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: '#94a3b8',
            font: { size: 12 },
            stepSize: 20,
            callback(value) {
              return value;
            }
          },
          grid: {
            color: 'rgba(59, 130, 246, 0.1)',
            lineWidth: 1,
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: '#cbd5e1',
            font: { size: 12, weight: '600' }
          },
          grid: {
            display: false,
            drawBorder: false
          }
        }
      },
      animation: {
        duration: 800,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function updateAnalyticsCharts(analysisData = {}, context = {}) {
  if (chartState.radar) {
    chartState.radar.data.datasets[0].label = context.title ? context.title : 'Current idea';
    chartState.radar.data.datasets[0].data = deriveRadarScores(analysisData, context);
    chartState.radar.update();
  }

  if (chartState.doughnut) {
    const revenueMix = extractRevenueMix(analysisData);
    chartState.doughnut.data.labels = revenueMix.labels;
    chartState.doughnut.data.datasets[0].data = revenueMix.data;
    chartState.doughnut.data.datasets[0].backgroundColor = revenueMix.labels.map((label) => {
      const key = label.toLowerCase();
      if (key.includes('subscription')) return chartColors.primary;
      if (key.includes('ads')) return chartColors.purple;
      if (key.includes('marketplace')) return chartColors.pink;
      if (key.includes('delivery')) return chartColors.warning;
      return chartColors.accent;
    });
    chartState.doughnut.update();
  }

  if (chartState.bar) {
    const text = textBlob(analysisData, context);
    const categoryScores = detectCategory(text);
    const topSix = categoryScores.slice(0, 6);
    chartState.bar.data.labels = topSix.map((item) => item.label);
    chartState.bar.data.datasets[0].label = context.title ? `${context.title} category fit` : 'Idea Category Fit';
    chartState.bar.data.datasets[0].data = topSix.map((item) => clampScore(item.score * 25));
    chartState.bar.data.datasets[0].backgroundColor = topSix.map((item, index) => {
      const palette = [chartColors.primary, chartColors.secondary, chartColors.accent, chartColors.purple, chartColors.pink, chartColors.warning];
      return palette[index % palette.length];
    });
    chartState.bar.data.datasets[0].hoverBackgroundColor = topSix.map((item, index) => {
      const palette = [chartColors.primary, chartColors.secondary, chartColors.accent, chartColors.purple, chartColors.pink, chartColors.warning];
      return `${palette[index % palette.length]}dd`;
    });
    chartState.bar.update();
  }
}

window.updateAnalyticsCharts = updateAnalyticsCharts;

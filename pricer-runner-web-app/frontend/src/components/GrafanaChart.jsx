import { useEffect, useRef } from 'react'
import './GrafanaChart.css'

function GrafanaChart({ grafanaUrl = 'http://localhost:3000' }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    // Use Grafana Explore with a direct Prometheus query
    // This is more reliable than provisioning dashboards
    const from = 'now-1h'
    const to = 'now'
    
    // Encode the query for the explore URL
    const query = encodeURIComponent('prompt_savings_percentage{comparison_type="all_models"}')
    const exploreUrl = `${grafanaUrl}/explore?orgId=1&left=["${from}","${to}","Prometheus",{"expr":"${query}","refId":"A"}]&theme=light`
    
    if (iframeRef.current) {
      iframeRef.current.src = exploreUrl
    }
  }, [grafanaUrl])

  return (
    <div className="grafana-chart-container">
      <h3 className="grafana-chart-title">Savings Trend Over Time</h3>
      <div className="grafana-chart-wrapper">
        <iframe
          ref={iframeRef}
          className="grafana-chart-iframe"
          title="Grafana Savings Chart"
          frameBorder="0"
          allowFullScreen
        />
      </div>
      <p className="grafana-chart-note">
        Showing savings percentage for all prompt comparisons
      </p>
    </div>
  )
}

export default GrafanaChart


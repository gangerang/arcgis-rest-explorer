import React, { useState } from 'react';
import { Form, Button, Table, Alert, Spinner, Badge } from 'react-bootstrap';
import { ArcGISService, ArcGISQueryResponse } from '../types/arcgis.types';
import { ArcGISServiceClient } from '../services/arcgisService';

interface LayerQueryProps {
  service: ArcGISService;
}

const LayerQuery: React.FC<LayerQueryProps> = ({ service }) => {
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [whereClause, setWhereClause] = useState<string>('1=1');
  const [includeGeometry, setIncludeGeometry] = useState<boolean>(false);
  const [resultLimit, setResultLimit] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [queryResult, setQueryResult] = useState<ArcGISQueryResponse | null>(null);

  const handleQuery = async () => {
    if (selectedLayerId === null) {
      setError('Please select a layer');
      return;
    }

    setLoading(true);
    setError('');
    setQueryResult(null);

    try {
      const result = await ArcGISServiceClient.queryLayer(
        service.url,
        selectedLayerId,
        {
          where: whereClause,
          returnGeometry: includeGeometry,
          resultRecordCount: resultLimit,
        }
      );

      setQueryResult(result);

      if (result.exceededTransferLimit) {
        setError('Warning: Result limit exceeded. Not all features returned.');
      }
    } catch (err: any) {
      setError(`Query failed: ${err.message}`);
      console.error('Error querying layer:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!queryResult || !queryResult.features || queryResult.features.length === 0) {
      return;
    }

    // Get all attribute keys from first feature
    const attributes = queryResult.features[0].attributes;
    const headers = Object.keys(attributes);

    // Create CSV content
    let csv = headers.join(',') + '\n';
    queryResult.features.forEach((feature) => {
      const row = headers.map((header) => {
        const value = feature.attributes[header];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = value?.toString() || '';
        return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
      });
      csv += row.join(',') + '\n';
    });

    // Download file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${service.name}_layer${selectedLayerId}_query.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!queryResult) {
      return;
    }

    const json = JSON.stringify(queryResult, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${service.name}_layer${selectedLayerId}_query.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportGeoJSON = () => {
    if (!queryResult || !queryResult.features) {
      return;
    }

    // Convert ArcGIS REST format to GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: queryResult.features.map((feature) => ({
        type: 'Feature',
        properties: feature.attributes,
        geometry: feature.geometry || null,
      })),
      crs: queryResult.spatialReference
        ? {
            type: 'name',
            properties: {
              name: `EPSG:${queryResult.spatialReference.wkid || queryResult.spatialReference.latestWkid || 4326}`,
            },
          }
        : undefined,
    };

    const json = JSON.stringify(geojson, null, 2);
    const blob = new Blob([json], { type: 'application/geo+json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${service.name}_layer${selectedLayerId}_query.geojson`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get layers and tables for selection
  const layerOptions = [
    ...(service.layers || []),
    ...(service.tables || []).map((table) => ({ ...table, type: 'Table' })),
  ];

  return (
    <>
      {/* Query Form */}
      <Form>
          <Form.Group className="mb-3">
            <Form.Label>Select Layer/Table</Form.Label>
            <Form.Select
              value={selectedLayerId ?? ''}
              onChange={(e) => setSelectedLayerId(Number(e.target.value))}
            >
              <option value="">-- Select a layer --</option>
              {layerOptions.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.id}: {layer.name} {layer.type ? `(${layer.type})` : ''}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Where Clause</Form.Label>
            <Form.Control
              type="text"
              value={whereClause}
              onChange={(e) => setWhereClause(e.target.value)}
              placeholder="1=1"
            />
            <Form.Text className="text-muted">
              SQL where clause (e.g., 1=1 for all records, or OBJECTID {'<'} 100)
            </Form.Text>
          </Form.Group>

          <div className="mb-3 d-flex gap-3 align-items-center">
            <Form.Check
              type="checkbox"
              label="Include Geometry"
              checked={includeGeometry}
              onChange={(e) => setIncludeGeometry(e.target.checked)}
            />

            <Form.Group className="mb-0" style={{ width: '200px' }}>
              <Form.Label className="mb-0 me-2">Result Limit:</Form.Label>
              <Form.Control
                type="number"
                value={resultLimit}
                onChange={(e) => setResultLimit(Number(e.target.value))}
                min={1}
                max={10000}
              />
            </Form.Group>
          </div>

          <Button
            onClick={handleQuery}
            disabled={loading || selectedLayerId === null}
            variant="primary"
          >
            {loading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Querying...
              </>
            ) : (
              'Execute Query'
            )}
          </Button>
        </Form>

        {/* Error Display */}
        {error && (
          <Alert variant={error.startsWith('Warning') ? 'warning' : 'danger'} className="mt-3">
            {error}
          </Alert>
        )}

        {/* Query Results */}
        {queryResult && queryResult.features && (
          <div className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>
                Results: {queryResult.features.length} feature(s)
                {queryResult.exceededTransferLimit && (
                  <Badge bg="warning" text="dark" className="ms-2">
                    Limit Exceeded
                  </Badge>
                )}
              </h5>
              <div className="d-flex gap-2">
                <Button size="sm" variant="outline-success" onClick={handleExportCSV}>
                  Export CSV
                </Button>
                <Button size="sm" variant="outline-info" onClick={handleExportJSON}>
                  Export JSON
                </Button>
                {includeGeometry && (
                  <Button size="sm" variant="outline-primary" onClick={handleExportGeoJSON}>
                    Export GeoJSON
                  </Button>
                )}
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto' }}>
              <Table striped bordered hover size="sm">
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
                  <tr>
                    {queryResult.features.length > 0 &&
                      Object.keys(queryResult.features[0].attributes).map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    {includeGeometry && <th>Geometry</th>}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.features.map((feature, index) => (
                    <tr key={index}>
                      {Object.values(feature.attributes).map((value, i) => (
                        <td key={i}>
                          {value !== null && value !== undefined
                            ? typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)
                            : '-'}
                        </td>
                      ))}
                      {includeGeometry && (
                        <td>
                          <small className="text-muted">
                            {feature.geometry ? JSON.stringify(feature.geometry).substring(0, 50) + '...' : '-'}
                          </small>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {queryResult.features.length === 0 && (
              <Alert variant="info">No features found matching the query.</Alert>
            )}
          </div>
        )}
    </>
  );
};

export default LayerQuery;

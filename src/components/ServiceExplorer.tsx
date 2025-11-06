import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Alert, Spinner, ProgressBar, Dropdown, ButtonGroup } from 'react-bootstrap';
import { ArcGISService } from '../types/arcgis.types';
import { ArcGISServiceClient } from '../services/arcgisService';
import { StorageService } from '../services/storageService';
import ServiceTable from './ServiceTable';
import LayerQuery from './LayerQuery';

const ServiceExplorer: React.FC = () => {
  const [url, setUrl] = useState<string>('https://mapservices.randwick.nsw.gov.au/arcgis/rest/services');
  const [services, setServices] = useState<ArcGISService[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedService, setSelectedService] = useState<ArcGISService | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; message: string }>({
    current: 0,
    total: 1,
    message: '',
  });
  const [history, setHistory] = useState(StorageService.getHistory());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setHistory(StorageService.getHistory());
  }, []);

  const handleExplore = async (useCache: boolean = true) => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');
    setServices([]);
    setSelectedService(null);
    setProgress({ current: 0, total: 1, message: 'Starting...' });

    try {
      const normalizedUrl = ArcGISServiceClient.normalizeUrl(url);

      const fetchedServices = await ArcGISServiceClient.getCatalog(
        normalizedUrl,
        useCache,
        (current, total, message) => {
          setProgress({ current, total, message });
        }
      );

      setServices(fetchedServices);
      StorageService.addToHistory(normalizedUrl);
      setHistory(StorageService.getHistory());
    } catch (err: any) {
      if (err.message === 'Discovery cancelled') {
        setError('Service discovery was cancelled');
      } else {
        setError(`Failed to fetch services: ${err.message}`);
      }
      console.error('Error exploring services:', err);
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 1, message: '' });
    }
  };

  const handleCancel = () => {
    ArcGISServiceClient.cancelDiscovery();
  };

  const handleClearCache = async () => {
    await ArcGISServiceClient.clearCache();
    alert('Cache cleared successfully');
  };

  const handleSelectHistory = (historyUrl: string) => {
    setUrl(historyUrl);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    StorageService.clearHistory();
    setHistory([]);
    setShowHistory(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExplore();
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">ArcGIS REST Service Explorer</h1>
        <Button variant="outline-secondary" size="sm" onClick={handleClearCache}>
          Clear Cache
        </Button>
      </div>

      {/* URL Input */}
      <Form.Group className="mb-4">
        <Form.Label>ArcGIS REST Service URL</Form.Label>
        <div className="d-flex gap-2">
          <div className="flex-grow-1 position-relative">
            <Form.Control
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://mapservices.randwick.nsw.gov.au/arcgis/rest/services"
              disabled={loading}
            />
          </div>

          {history.length > 0 && (
            <Dropdown show={showHistory} onToggle={(show) => setShowHistory(show)}>
              <Dropdown.Toggle variant="outline-secondary" disabled={loading}>
                History
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {history.map((entry, index) => (
                  <Dropdown.Item
                    key={index}
                    onClick={() => handleSelectHistory(entry.url)}
                  >
                    {entry.url.length > 50 ? `...${entry.url.slice(-47)}` : entry.url}
                  </Dropdown.Item>
                ))}
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleClearHistory}>
                  Clear History
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          )}

          <ButtonGroup>
            <Button
              onClick={() => handleExplore(true)}
              disabled={loading}
              variant="primary"
              style={{ minWidth: '100px' }}
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
                  Exploring...
                </>
              ) : (
                'Explore'
              )}
            </Button>
            {loading && (
              <Button onClick={handleCancel} variant="danger" size="sm">
                Cancel
              </Button>
            )}
            {!loading && services.length === 0 && (
              <Button
                onClick={() => handleExplore(false)}
                variant="outline-primary"
                title="Refresh without cache"
              >
                ↻
              </Button>
            )}
          </ButtonGroup>
        </div>
        <Form.Text className="text-muted">
          Enter the base URL of an ArcGIS REST services endpoint
        </Form.Text>
      </Form.Group>

      {/* Progress Bar */}
      {loading && progress.message && (
        <div className="mb-3">
          <div className="d-flex justify-content-between mb-1">
            <small className="text-muted">{progress.message}</small>
            <small className="text-muted">
              {progress.current} / {progress.total}
            </small>
          </div>
          <ProgressBar
            now={progressPercentage}
            animated
            label={`${Math.round(progressPercentage)}%`}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {services.length > 0 && (
        <>
          <ServiceTable
            services={services}
            onServiceSelect={setSelectedService}
          />

          {selectedService && (
            <div className="mt-4">
              <LayerQuery service={selectedService} />
            </div>
          )}
        </>
      )}

      {/* No Results */}
      {!loading && services.length === 0 && !error && (
        <Alert variant="info">
          Enter a URL above to start exploring ArcGIS REST services
        </Alert>
      )}
    </Container>
  );
};

export default ServiceExplorer;

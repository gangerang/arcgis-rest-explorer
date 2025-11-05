import React, { useState } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { ArcGISService } from '../types/arcgis.types';
import { ArcGISServiceClient } from '../services/arcgisService';
import ServiceTable from './ServiceTable';
import LayerQuery from './LayerQuery';

const ServiceExplorer: React.FC = () => {
  const [url, setUrl] = useState<string>('https://mapservices.randwick.nsw.gov.au/arcgis/rest/services');
  const [services, setServices] = useState<ArcGISService[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedService, setSelectedService] = useState<ArcGISService | null>(null);

  const handleExplore = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');
    setServices([]);
    setSelectedService(null);

    try {
      const normalizedUrl = ArcGISServiceClient.normalizeUrl(url);
      const fetchedServices = await ArcGISServiceClient.getCatalog(normalizedUrl);
      setServices(fetchedServices);
    } catch (err: any) {
      setError(`Failed to fetch services: ${err.message}`);
      console.error('Error exploring services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExplore();
    }
  };

  return (
    <Container fluid className="py-4">
      <h1 className="mb-4">ArcGIS REST Service Explorer</h1>

      {/* URL Input */}
      <Form.Group className="mb-4">
        <Form.Label>ArcGIS REST Service URL</Form.Label>
        <div className="d-flex gap-2">
          <Form.Control
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="https://mapservices.randwick.nsw.gov.au/arcgis/rest/services"
            disabled={loading}
          />
          <Button
            onClick={handleExplore}
            disabled={loading}
            variant="primary"
            style={{ minWidth: '120px' }}
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
        </div>
        <Form.Text className="text-muted">
          Enter the base URL of an ArcGIS REST services endpoint
        </Form.Text>
      </Form.Group>

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

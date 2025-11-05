import axios, { AxiosError } from 'axios';
import {
  ArcGISCatalogResponse,
  ArcGISService,
  ArcGISLayerDetails,
  ArcGISQueryResponse,
  QueryOptions,
  ServiceStatus,
} from '../types/arcgis.types';

export class ArcGISServiceClient {
  /**
   * Fetches the catalog of services from an ArcGIS REST endpoint
   */
  static async getCatalog(baseUrl: string): Promise<ArcGISService[]> {
    const services: ArcGISService[] = [];

    try {
      // Fetch root catalog
      const rootServices = await this.fetchCatalogLevel(baseUrl, '');
      services.push(...rootServices);

      // Fetch services from each folder
      const catalogResponse = await this.fetchRaw(baseUrl, '');
      if (catalogResponse.folders && catalogResponse.folders.length > 0) {
        for (const folder of catalogResponse.folders) {
          const folderServices = await this.fetchCatalogLevel(baseUrl, folder);
          services.push(...folderServices);
        }
      }
    } catch (error) {
      console.error('Error fetching catalog:', error);
      throw error;
    }

    return services;
  }

  /**
   * Fetches services from a specific folder level
   */
  private static async fetchCatalogLevel(
    baseUrl: string,
    folder: string
  ): Promise<ArcGISService[]> {
    const services: ArcGISService[] = [];

    try {
      const catalogData = await this.fetchRaw(baseUrl, folder);

      if (catalogData.services && catalogData.services.length > 0) {
        for (const serviceInfo of catalogData.services) {
          const serviceUrl = this.buildServiceUrl(baseUrl, serviceInfo.name, serviceInfo.type);
          const service: ArcGISService = {
            name: serviceInfo.name,
            type: serviceInfo.type,
            url: serviceUrl,
            folder: folder || 'root',
            requiresAuth: false,
            isEmpty: false,
          };

          // Try to get detailed service info
          try {
            const details = await this.getServiceDetails(serviceUrl);
            service.layerCount = details.layers?.length || 0;
            service.tableCount = details.tables?.length || 0;
            service.description = details.description || details.serviceDescription;
            service.capabilities = details.capabilities;
            service.layers = details.layers;
            service.tables = details.tables;
          } catch (error) {
            const status = await this.checkServiceStatus(serviceUrl);
            service.requiresAuth = status.requiresAuth;
            service.isEmpty = status.isEmpty;
            service.error = status.error;
          }

          services.push(service);
        }
      } else if (folder) {
        // Empty folder
        const emptyFolderService: ArcGISService = {
          name: folder,
          type: 'Folder',
          url: `${baseUrl}/${folder}`,
          folder: folder,
          requiresAuth: false,
          isEmpty: true,
        };
        services.push(emptyFolderService);
      }
    } catch (error) {
      console.error(`Error fetching catalog level for folder "${folder}":`, error);
      if (folder) {
        const status = await this.checkServiceStatus(`${baseUrl}/${folder}`);
        const errorService: ArcGISService = {
          name: folder,
          type: 'Folder',
          url: `${baseUrl}/${folder}`,
          folder: folder,
          requiresAuth: status.requiresAuth,
          isEmpty: status.isEmpty,
          error: status.error,
        };
        services.push(errorService);
      }
    }

    return services;
  }

  /**
   * Fetches raw catalog data
   */
  private static async fetchRaw(
    baseUrl: string,
    folder: string
  ): Promise<ArcGISCatalogResponse> {
    const url = folder ? `${baseUrl}/${folder}` : baseUrl;
    const response = await axios.get(url, {
      params: { f: 'json' },
      timeout: 10000,
    });
    return response.data;
  }

  /**
   * Gets detailed information about a specific service
   */
  static async getServiceDetails(serviceUrl: string): Promise<any> {
    const response = await axios.get(serviceUrl, {
      params: { f: 'json' },
      timeout: 10000,
    });
    return response.data;
  }

  /**
   * Checks if a service requires authentication or has other access issues
   */
  static async checkServiceStatus(url: string): Promise<ServiceStatus> {
    try {
      const response = await axios.get(url, {
        params: { f: 'json' },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: (status) => status < 500,
      });

      // Check for empty response
      if (!response.data || Object.keys(response.data).length === 0) {
        return {
          accessible: false,
          requiresAuth: false,
          isEmpty: true,
          redirected: false,
          error: 'Empty response',
        };
      }

      // Check for error in response
      if (response.data.error) {
        const errorCode = response.data.error.code;
        return {
          accessible: false,
          requiresAuth: errorCode === 499 || errorCode === 498,
          isEmpty: false,
          redirected: false,
          error: response.data.error.message || 'Service error',
        };
      }

      return {
        accessible: true,
        requiresAuth: false,
        isEmpty: false,
        redirected: false,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Check for authentication required
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        return {
          accessible: false,
          requiresAuth: true,
          isEmpty: false,
          redirected: false,
          error: 'Authentication required',
        };
      }

      // Check for redirect
      if (axiosError.response?.status === 302 || axiosError.response?.status === 301) {
        return {
          accessible: false,
          requiresAuth: true,
          isEmpty: false,
          redirected: true,
          error: 'Redirected to login',
        };
      }

      return {
        accessible: false,
        requiresAuth: false,
        isEmpty: false,
        redirected: false,
        error: axiosError.message || 'Unknown error',
      };
    }
  }

  /**
   * Gets detailed information about a specific layer
   */
  static async getLayerDetails(
    serviceUrl: string,
    layerId: number
  ): Promise<ArcGISLayerDetails> {
    const url = `${serviceUrl}/${layerId}`;
    const response = await axios.get(url, {
      params: { f: 'json' },
      timeout: 10000,
    });
    return response.data;
  }

  /**
   * Queries a layer with specified options
   */
  static async queryLayer(
    serviceUrl: string,
    layerId: number,
    options: QueryOptions = {}
  ): Promise<ArcGISQueryResponse> {
    const url = `${serviceUrl}/${layerId}/query`;

    const params = {
      where: options.where || '1=1',
      outFields: options.outFields || '*',
      returnGeometry: options.returnGeometry !== false,
      f: 'json',
      resultRecordCount: options.resultRecordCount || 1000,
    };

    const response = await axios.get(url, {
      params,
      timeout: 30000,
    });

    return response.data;
  }

  /**
   * Builds a full service URL from base URL, service name, and type
   */
  private static buildServiceUrl(
    baseUrl: string,
    serviceName: string,
    serviceType: string
  ): string {
    return `${baseUrl}/${serviceName}/${serviceType}`;
  }

  /**
   * Validates and normalizes a URL
   */
  static normalizeUrl(url: string): string {
    // Remove trailing slashes
    url = url.replace(/\/+$/, '');

    // Ensure it ends with /rest/services if it doesn't already
    if (!url.includes('/rest/services')) {
      if (url.endsWith('/arcgis')) {
        url += '/rest/services';
      } else if (url.endsWith('/rest')) {
        url += '/services';
      } else {
        url += '/arcgis/rest/services';
      }
    }

    return url;
  }
}

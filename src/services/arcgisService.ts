import axios, { AxiosError } from 'axios';
import {
  ArcGISCatalogResponse,
  ArcGISService,
  ArcGISLayerDetails,
  ArcGISQueryResponse,
  QueryOptions,
  ServiceStatus,
  ArcGISResource,
} from '../types/arcgis.types';
import { CacheService } from './cacheService';

export interface ProgressCallback {
  (current: number, total: number, message: string): void;
}

export class ArcGISServiceClient {
  private static abortController: AbortController | null = null;

  /**
   * Fetches the catalog of services from an ArcGIS REST endpoint with caching and parallel loading
   */
  static async getCatalog(
    baseUrl: string,
    useCache: boolean = true,
    onProgress?: ProgressCallback
  ): Promise<ArcGISService[]> {
    // Check cache first
    if (useCache) {
      const cacheKey = CacheService.KEYS.SERVICE_CATALOG(baseUrl);
      const cached = await CacheService.get<ArcGISService[]>(cacheKey);
      if (cached) {
        console.log('Loaded services from cache');
        return cached;
      }
    }

    const services: ArcGISService[] = [];
    this.abortController = new AbortController();

    try {
      onProgress?.(0, 1, 'Fetching root catalog...');

      // Fetch root catalog
      const rootServices = await this.fetchCatalogLevel(baseUrl, '', onProgress);
      services.push(...rootServices);

      // Fetch services from each folder in parallel
      const catalogResponse = await this.fetchRaw(baseUrl, '');
      if (catalogResponse.folders && catalogResponse.folders.length > 0) {
        const folders = catalogResponse.folders;
        const totalFolders = folders.length + 1; // +1 for root

        onProgress?.(1, totalFolders, `Processing ${folders.length} folders...`);

        // Fetch all folders in parallel
        const folderPromises = folders.map((folder, index) =>
          this.fetchCatalogLevel(baseUrl, folder, (current, total, msg) => {
            onProgress?.(index + 2, totalFolders, `Processing folder: ${folder}`);
          })
        );

        const folderResults = await Promise.allSettled(folderPromises);

        folderResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            services.push(...result.value);
          } else {
            console.error(`Failed to fetch folder ${folders[index]}:`, result.reason);
          }
        });
      }

      onProgress?.(1, 1, 'Complete');

      // Cache the results
      if (useCache) {
        const cacheKey = CacheService.KEYS.SERVICE_CATALOG(baseUrl);
        await CacheService.set(cacheKey, services, CacheService.TTL.MEDIUM);
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Service discovery cancelled');
        throw new Error('Discovery cancelled');
      }
      console.error('Error fetching catalog:', error);
      throw error;
    }

    return services;
  }

  /**
   * Cancel ongoing service discovery
   */
  static cancelDiscovery(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Fetches services from a specific folder level
   */
  private static async fetchCatalogLevel(
    baseUrl: string,
    folder: string,
    onProgress?: ProgressCallback
  ): Promise<ArcGISService[]> {
    const services: ArcGISService[] = [];

    try {
      const catalogData = await this.fetchRaw(baseUrl, folder);

      if (catalogData.services && catalogData.services.length > 0) {
        // Fetch service details in parallel
        const servicePromises = catalogData.services.map(async (serviceInfo) => {
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
            const details = await this.getServiceDetails(serviceUrl, true);
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

          return service;
        });

        const results = await Promise.allSettled(servicePromises);
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            services.push(result.value);
          }
        });
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
      signal: this.abortController?.signal,
    });
    return response.data;
  }

  /**
   * Gets detailed information about a specific service
   */
  static async getServiceDetails(serviceUrl: string, useCache: boolean = true): Promise<any> {
    // Check cache first
    if (useCache) {
      const cacheKey = CacheService.KEYS.SERVICE_DETAILS(serviceUrl);
      const cached = await CacheService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const startTime = Date.now();
    const response = await axios.get(serviceUrl, {
      params: { f: 'json' },
      timeout: 10000,
    });

    const data = response.data;
    data.responseTime = Date.now() - startTime;

    // Cache the result
    if (useCache) {
      const cacheKey = CacheService.KEYS.SERVICE_DETAILS(serviceUrl);
      await CacheService.set(cacheKey, data, CacheService.TTL.LONG);
    }

    return data;
  }

  /**
   * Checks if a service requires authentication or has other access issues
   */
  static async checkServiceStatus(url: string): Promise<ServiceStatus> {
    const startTime = Date.now();

    try {
      const response = await axios.get(url, {
        params: { f: 'json' },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: (status) => status < 500,
      });

      const responseTime = Date.now() - startTime;

      // Check for empty response
      if (!response.data || Object.keys(response.data).length === 0) {
        return {
          accessible: false,
          requiresAuth: false,
          isEmpty: true,
          redirected: false,
          error: 'Empty response',
          responseTime,
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
          responseTime,
        };
      }

      return {
        accessible: true,
        requiresAuth: false,
        isEmpty: false,
        redirected: false,
        responseTime,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const responseTime = Date.now() - startTime;

      // Check for authentication required
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        return {
          accessible: false,
          requiresAuth: true,
          isEmpty: false,
          redirected: false,
          error: 'Authentication required',
          responseTime,
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
          responseTime,
        };
      }

      return {
        accessible: false,
        requiresAuth: false,
        isEmpty: false,
        redirected: false,
        error: axiosError.message || 'Unknown error',
        responseTime,
      };
    }
  }

  /**
   * Gets detailed information about a specific layer
   */
  static async getLayerDetails(
    serviceUrl: string,
    layerId: number,
    useCache: boolean = true
  ): Promise<ArcGISLayerDetails> {
    // Check cache first
    if (useCache) {
      const cacheKey = CacheService.KEYS.LAYER_DETAILS(serviceUrl, layerId);
      const cached = await CacheService.get<ArcGISLayerDetails>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const url = `${serviceUrl}/${layerId}`;
    const response = await axios.get(url, {
      params: { f: 'json' },
      timeout: 10000,
    });

    const data = response.data;

    // Cache the result
    if (useCache) {
      const cacheKey = CacheService.KEYS.LAYER_DETAILS(serviceUrl, layerId);
      await CacheService.set(cacheKey, data, CacheService.TTL.LONG);
    }

    return data;
  }

  /**
   * Queries a layer with specified options
   */
  static async queryLayer(
    serviceUrl: string,
    layerId: number,
    options: QueryOptions = {},
    useCache: boolean = false
  ): Promise<ArcGISQueryResponse> {
    const url = `${serviceUrl}/${layerId}/query`;

    const params = {
      where: options.where || '1=1',
      outFields: options.outFields || '*',
      returnGeometry: options.returnGeometry !== false,
      f: 'json',
      resultRecordCount: options.resultRecordCount || 1000,
    };

    // Check cache for queries
    if (useCache) {
      const cacheKey = CacheService.KEYS.QUERY_RESULT(
        serviceUrl,
        layerId,
        JSON.stringify(params)
      );
      const cached = await CacheService.get<ArcGISQueryResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const response = await axios.get(url, {
      params,
      timeout: 30000,
    });

    const data = response.data;

    // Cache the result for short duration
    if (useCache) {
      const cacheKey = CacheService.KEYS.QUERY_RESULT(
        serviceUrl,
        layerId,
        JSON.stringify(params)
      );
      await CacheService.set(cacheKey, data, CacheService.TTL.SHORT);
    }

    return data;
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

  /**
   * Fetches all resources (layers and tables) from all services with detailed information
   */
  static async getResourceCatalog(
    baseUrl: string,
    useCache: boolean = true,
    onProgress?: ProgressCallback
  ): Promise<ArcGISResource[]> {
    // Check cache first
    if (useCache) {
      const cacheKey = CacheService.KEYS.SERVICE_CATALOG(baseUrl + '_resources');
      const cached = await CacheService.get<ArcGISResource[]>(cacheKey);
      if (cached) {
        console.log('Loaded resources from cache');
        return cached;
      }
    }

    const resources: ArcGISResource[] = [];
    this.abortController = new AbortController();

    try {
      // First get all services
      onProgress?.(0, 1, 'Fetching services...');
      const services = await this.getCatalog(baseUrl, useCache, onProgress);

      // Filter to only services that have layers or tables
      const servicesWithResources = services.filter(
        (s) => (s.layers && s.layers.length > 0) || (s.tables && s.tables.length > 0)
      );

      if (servicesWithResources.length === 0) {
        return resources;
      }

      onProgress?.(0, servicesWithResources.length, 'Fetching resource details...');

      // Fetch details for each resource in parallel (but in batches to avoid overwhelming the server)
      const batchSize = 10;
      for (let i = 0; i < servicesWithResources.length; i += batchSize) {
        const batch = servicesWithResources.slice(i, i + batchSize);

        const batchPromises = batch.map(async (service) => {
          const serviceResources: ArcGISResource[] = [];

          // Process layers
          if (service.layers) {
            for (const layer of service.layers) {
              try {
                const details = await this.getLayerDetails(service.url, layer.id, useCache);

                serviceResources.push({
                  id: layer.id,
                  name: layer.name,
                  type: 'Layer',
                  serviceName: service.name,
                  serviceType: service.type,
                  serviceUrl: service.url,
                  resourceUrl: `${service.url}/${layer.id}`,
                  folder: service.folder,
                  geometryType: details.geometryType || layer.geometryType,
                  fieldCount: details.fields?.length,
                  fields: details.fields,
                  description: details.description,
                  editFieldsInfo: (details as any).editFieldsInfo,
                  hasTimestamp: !!(details as any).editFieldsInfo?.editDateField || !!(details as any).timeInfo,
                  requiresAuth: false,
                });
              } catch (error) {
                // If we can't fetch details, still add the basic info
                serviceResources.push({
                  id: layer.id,
                  name: layer.name,
                  type: 'Layer',
                  serviceName: service.name,
                  serviceType: service.type,
                  serviceUrl: service.url,
                  resourceUrl: `${service.url}/${layer.id}`,
                  folder: service.folder,
                  geometryType: layer.geometryType,
                  requiresAuth: service.requiresAuth,
                  error: 'Could not fetch details',
                });
              }
            }
          }

          // Process tables
          if (service.tables) {
            for (const table of service.tables) {
              try {
                const details = await this.getLayerDetails(service.url, table.id, useCache);

                serviceResources.push({
                  id: table.id,
                  name: table.name,
                  type: 'Table',
                  serviceName: service.name,
                  serviceType: service.type,
                  serviceUrl: service.url,
                  resourceUrl: `${service.url}/${table.id}`,
                  folder: service.folder,
                  fieldCount: details.fields?.length,
                  fields: details.fields,
                  description: details.description,
                  editFieldsInfo: (details as any).editFieldsInfo,
                  hasTimestamp: !!(details as any).editFieldsInfo?.editDateField || !!(details as any).timeInfo,
                  requiresAuth: false,
                });
              } catch (error) {
                // If we can't fetch details, still add the basic info
                serviceResources.push({
                  id: table.id,
                  name: table.name,
                  type: 'Table',
                  serviceName: service.name,
                  serviceType: service.type,
                  serviceUrl: service.url,
                  resourceUrl: `${service.url}/${table.id}`,
                  folder: service.folder,
                  requiresAuth: service.requiresAuth,
                  error: 'Could not fetch details',
                });
              }
            }
          }

          return serviceResources;
        });

        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            resources.push(...result.value);
          }
        });

        onProgress?.(
          Math.min(i + batchSize, servicesWithResources.length),
          servicesWithResources.length,
          `Processed ${Math.min(i + batchSize, servicesWithResources.length)} of ${servicesWithResources.length} services...`
        );
      }

      onProgress?.(1, 1, 'Complete');

      // Cache the results
      if (useCache) {
        const cacheKey = CacheService.KEYS.SERVICE_CATALOG(baseUrl + '_resources');
        await CacheService.set(cacheKey, resources, CacheService.TTL.MEDIUM);
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Resource discovery cancelled');
        throw new Error('Discovery cancelled');
      }
      console.error('Error fetching resource catalog:', error);
      throw error;
    }

    return resources;
  }

  /**
   * Clear cache for a specific URL or all cache
   */
  static async clearCache(url?: string): Promise<void> {
    if (url) {
      const cacheKey = CacheService.KEYS.SERVICE_CATALOG(url);
      await CacheService.delete(cacheKey);
      // Also clear resources cache
      const resourcesCacheKey = CacheService.KEYS.SERVICE_CATALOG(url + '_resources');
      await CacheService.delete(resourcesCacheKey);
    } else {
      await CacheService.clear();
    }
  }
}

package com.mxgraph.online;

import java.util.Properties;
import java.util.concurrent.TimeUnit;

import javax.cache.Cache;
import javax.cache.CacheManager;
import javax.cache.Caching;
import javax.cache.configuration.MutableConfiguration;
import javax.cache.expiry.CreatedExpiryPolicy;
import javax.cache.expiry.Duration;
import javax.cache.spi.CachingProvider;

import org.memcached.jcache.MemcachedCachingProvider;

public class CacheFacade {

	private CacheFacade() {}

	public static Cache<String, String> createCache()
	{
		return createCache("cache", 300); // default values (one cache and 5 min)
	}

	public static Cache<String, String> createCache(String name, int expirationDelta)
	{
		String memcachedEndpoint = System.getenv("memcachedURL");

		CachingProvider provider = Caching.getCachingProvider(MemcachedCachingProvider.class.getName());
		Properties properties = provider.getDefaultProperties();
		properties.setProperty("servers", memcachedEndpoint);
		properties.setProperty(name + ".useSharedClientConnection", "true");
		CacheManager cacheManager = provider.getCacheManager(
			provider.getDefaultURI(), null, properties);
		
		MutableConfiguration<String, String> configuration =
		    new MutableConfiguration<String, String>()  
		        .setStoreByValue(false) //Memcached does not support store by value
		        .setExpiryPolicyFactory(CreatedExpiryPolicy.factoryOf(new Duration(TimeUnit.SECONDS, expirationDelta)));  
		return cacheManager.createCache(name, configuration);
	}

	public static String getStatistics()
	{
		//TODO implement this for memcached
		return "NYI";
	}
}

/**
 * $Id: ProxyServlet.java,v 1.4 2013/12/13 13:18:11 david Exp $
 * Copyright (c) 2011-2012, JGraph Ltd
 */
package com.mxgraph.online;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.Serializable;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import javax.cache.Cache;
import javax.cache.CacheException;
import javax.cache.CacheFactory;
import javax.cache.CacheManager;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.appengine.api.memcache.MemcacheService;
import com.google.appengine.api.memcache.MemcacheServiceFactory;
import com.google.appengine.api.memcache.Stats;
import com.google.appengine.api.memcache.stdimpl.GCacheFactory;
import com.pusher.rest.Pusher;

/**
 * Servlet implementation ProxyServlet
 */
@SuppressWarnings("serial")
public class CacheServlet extends HttpServlet
{
	/**
	 * Path component under war/ to locate iconfinder_key file.
	 */
	protected static final String PUSHER_CONFIG_FILE_PATH = "pusher_properties";

	/**
	 * Path component under war/ to locate iconfinder_key file.
	 */
	protected static final boolean debugOutput = false;

	/**
	 * Path component under war/ to locate iconfinder_key file.
	 */
	protected static final int expirationDelta = 300;

	/**
	 * Path component under war/ to locate iconfinder_key file.
	 */
	protected static final int maxCacheSize = 1000000;

	/**
	 * Path component under war/ to locate iconfinder_key file.
	 */
	protected static Pusher pusher = null;

	/**
	 * Global cache is used for patches, last versions and tokens. They are
	 * separated via their key formats as follows:
	 * 
	 * Patches use ID:VERSION and map to a CacheEntry which contains the next
	 * version, patch data and secret.
	 * 
	 * Last versions use ID@VERSION and map to a String which contains the
	 * known last version of the file. This is used to verify the secret.
	 * 
	 * Tokens use ID#SECRET and map to a String which contains the token.
	 * The token is used to authorize the patch in a subsequent request.
	 */
	protected static Cache cache;

	static
	{
		try
		{
			CacheFactory cacheFactory = CacheManager.getInstance()
					.getCacheFactory();
			Map<Object, Object> properties = new HashMap<>();
			properties.put(MemcacheService.SetPolicy.ADD_ONLY_IF_NOT_PRESENT,
					true);
			properties.put(GCacheFactory.EXPIRATION_DELTA, expirationDelta);
			cache = cacheFactory.createCache(properties);
		}
		catch (CacheException e)
		{
			e.printStackTrace();
		}
	}

	/**
	 * Creates the key for the cache entry.
	 */
	protected static String createCacheEntryKey(String id, String version)
	{
		return id + ":" + version;
	}

	/**
	 * Creates the key for the cache entry.
	 */
	protected static String createLastVersionKey(String id, String version)
	{
		return id + "@" + version;
	}

	/**
	 * Creates the key for the cache entry.
	 */
	protected static String createTokenKey(String id, String secret)
	{
		return id + "#" + secret;
	}

	/**
	 * @see HttpServlet#HttpServlet()
	 */
	public CacheServlet()
	{
		super();
	};

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected Pusher getPusher() throws IOException
	{
		//log.log(severityLevel, "CLIENT-LOG:" + message);

		if (pusher == null)
		{
			try
			{
				String input = SecretFacade.getSecret(PUSHER_CONFIG_FILE_PATH, getServletContext());
				// load a properties file
				Properties prop = new Properties();
				prop.load(new StringReader(input));

				pusher = new Pusher(prop.getProperty("app_id"),
						prop.getProperty("key"), prop.getProperty("secret"));
				pusher.setCluster(prop.getProperty("cluster"));
				pusher.setEncrypted(true);
			}
			catch(Exception e)
			{
				e.printStackTrace(); //Ignore
			}
		}

		return pusher;
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void doGet(HttpServletRequest request,
			HttpServletResponse response) throws ServletException, IOException
	{
		try
		{
			String qs = request.getQueryString();
			String ref = request.getHeader("referer");
			// Set ref to something to avoid extra null branch for sc_forbidden
			ref = ref == null ? "" : ref;
			boolean stats = qs != null && qs.equals("stats");
			boolean alive = qs != null && qs.equals("alive");

			String domain = ref.toLowerCase().matches(
					"^https?://([a-z0-9,-]+[.])*draw[.]io/.*") ? ".draw.io/"
							: null;
			domain = (domain == null) ? (ref.toLowerCase()
					.matches("^https?://([a-z0-9,-]+[.])*diagrams[.]net/.*")
							? ".diagrams.net/"
							: null)
					: domain;

			if (stats || alive || domain != null)
			{
				PrintWriter writer = response.getWriter();
				response.setCharacterEncoding("UTF-8");

				if (stats)
				{
					response.setContentType("text/plain");

					Stats s = MemcacheServiceFactory.getMemcacheService()
							.getStatistics();
					long hits = s.getHitCount();
					long miss = s.getMissCount();
					float rate = (float) hits / (hits + miss);
					writer.println("timestamp: " + new Date().toString());
					writer.println("hit rate: " + (miss > 0
							? (float) Math.round(rate * 100 * 100) / 100 + "%"
							: "100%"));
					writer.println("hit count: " + hits);
					writer.println("miss count: " + miss);
					writer.println("item count: " + s.getItemCount());
					writer.println(
							"total item bytes: " + s.getTotalItemBytes());
					writer.println("bytes returned for hits: "
							+ s.getBytesReturnedForHits());
					writer.println("max time without access: "
							+ s.getMaxTimeWithoutAccess());

					response.setStatus(HttpServletResponse.SC_OK);
				}
				else
				{
					response.addHeader("Access-Control-Allow-Origin",
							ref.toLowerCase().substring(0,
									ref.indexOf(domain) + domain.length() - 1));

					if (alive)
					{
						writer.println("<ok/>");
						response.setStatus(HttpServletResponse.SC_OK);
					}
					else
					{
						// Disables wire-compression
						response.setContentType("application/octet-stream");
						String id = request.getParameter("id");
						String from = request.getParameter("from");
						String to = request.getParameter("to");
						String secret = request.getParameter("secret");

						if (id != null)
						{
							try
							{
								if (secret != null
										&& (from == null || to == null))
								{
									writer.print(createToken(id, secret));
								}
								else if (from != null && to != null)
								{
									writer.print(
											getPatches(id, from, to, secret));
								}

								response.setStatus(HttpServletResponse.SC_OK);
							}
							catch (UnauthorizedException e)
							{
								response.setStatus(
									HttpServletResponse.SC_UNAUTHORIZED);
							}
							catch (IncompleteChainException e)
							{
								response.setStatus(
									HttpServletResponse.SC_GONE);
							}
						}
						else
						{
							response.setStatus(
								HttpServletResponse.SC_BAD_REQUEST);
						}
					}
				}

				writer.flush();
				writer.close();
			}
			else
			{
				response.setStatus(HttpServletResponse.SC_FORBIDDEN);
			}
		}
		catch (Exception e)
		{
			response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

			if (debugOutput)
			{
				e.printStackTrace();
			}
		}
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected String createToken(String id, String secret)
			throws UnauthorizedException
	{
		String key = createTokenKey(id, secret);

		if (!cache.containsKey(key))
		{
			String token = Utils.generateToken(32);
			cache.put(key, token);

			debug("createToken key=" + key + " token=" + token);

			return token;
		}
		else
		{
			throw new UnauthorizedException();
		}
	}

	/**
	 * Removes the given patch if the secret does not match.
	 */
	protected void checkPatch(String id, String current, String secret)
	{
		Object lastVersion = cache.remove(createLastVersionKey(id, current));

		if (lastVersion != null)
		{
			String key = createCacheEntryKey(id, lastVersion.toString());
			CacheEntry entry = (CacheEntry) cache.get(key);

			if (entry != null)
			{
				if (entry.getSecret() == null || !entry.getSecret().equals(secret))
				{
					cache.remove(key);
					debug("patch removed id=" + id + " from=" + lastVersion
							+ " to=" + current);
					
					// Marks the chain as incomplete
					cache.put(key, new CacheEntry(null, null, null));
				}
				else
				{
					debug("patch checked id=" + id + " from=" + lastVersion
							+ " to=" + current);
				}
			}
		}
		else
		{
			debug("check patch no last version for id=" + id + " current=" + current);
		}
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected String getPatches(String id, String from, String to, String secret)
		throws UnauthorizedException, IncompleteChainException
	{
		List<String> values = new ArrayList<String>();
		HashSet<String> seen = new HashSet<String>();
		String current = from;
		String data = "[]";

		while (!seen.contains(current))
		{
			CacheEntry entry = (CacheEntry) cache.get(createCacheEntryKey(id, current));

			if (entry != null)
			{
				if (entry.getData() == null || entry.getNext() == null
						|| entry.getSecret() == null)
				{
					debug("getPatches incomplete chain id=" + id + " from=" + from + " to=" + to);

					throw new IncompleteChainException();
				}
				else
				{
					seen.add(current);
					current = entry.getNext();
					values.add("\"" + entry.getData() + "\"");

					if (current.equals(to))
					{
						// Compares secret
						if (entry.getSecret() != null
								&& !entry.getSecret().equals(secret))
						{
							throw new UnauthorizedException();
						}
						else
						{
							break;
						}
					}
				}
			}
			else
			{
				values.clear();
				break;
			}
		}

		data = "[" + String.join(",", values) + "]";

		debug("getPatches id=" + id + " from=" + from + " to=" + to + " data="
				+ data);

		return data;
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void doPost(HttpServletRequest request,
			HttpServletResponse response) throws ServletException, IOException
	{
		try
		{
			String ref = request.getHeader("referer");
			// Set ref to something to avoid extra null branch for sc_forbidden
			ref = ref == null ? "" : ref;

			String domain = ref.toLowerCase().matches(
					"^https?://([a-z0-9,-]+[.])*draw[.]io/.*") ? ".draw.io/"
							: null;
			domain = (domain == null) ? (ref.toLowerCase()
					.matches("^https?://([a-z0-9,-]+[.])*diagrams[.]net/.*")
							? ".diagrams.net/"
							: null)
					: domain;

			if (domain != null)
			{
				String id = request.getParameter("id");

				if (id != null)
				{
					response.addHeader("Access-Control-Allow-Origin",
							ref.toLowerCase().substring(0,
									ref.indexOf(domain) + domain.length() - 1));

					addPatch(id, request.getParameter("data"),
							request.getParameter("secret"),
							request.getParameter("token"),
							request.getParameter("from"),
							request.getParameter("to"),
							request.getParameter("last-secret"));
					sendMessage(id, request.getParameter("msg"),
							request.getParameter("sid"));

					PrintWriter writer = response.getWriter();
					writer.println("<ok/>");
					writer.flush();
					writer.close();

					response.setStatus(HttpServletResponse.SC_OK);
				}
				else
				{
					response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
				}
			}
			else
			{
				response.setStatus(HttpServletResponse.SC_FORBIDDEN);
			}
		}
		catch (UnauthorizedException e)
		{
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
		}
		catch (Exception e)
		{
			response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
		}
	}

	/**
	 * Adds the given patch and returns true if collaborators should be notified.
	 */
	protected void addPatch(String id, String data, String secret, String token,
			String from, String to, String lastSecret)
			throws UnauthorizedException
	{
		if (secret != null && cache.remove(createTokenKey(id, secret), token))
		{
			if (from != null && to != null && data != null
					&& data.length() < maxCacheSize)
			{
				// Checks if the last patch has a valid secret
				checkPatch(id, from, lastSecret);
				cache.put(createCacheEntryKey(id, from),
					new CacheEntry(to, data, secret));

				// Maps from current to last for keeping chain valid
				if (secret != null)
				{
					cache.put(createLastVersionKey(id, to), from);
				}

				debug("addPatch id=" + id + " from=" + from + " to=" + to
						+ " secret=" + secret + " token=" + token + " data="
						+ data);
			}
		}
		else if (data != null)
		{
			throw new UnauthorizedException();
		}
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void sendMessage(String id, String msg, String sid)
			throws IOException
	{
		if (msg != null)
		{
			getPusher().trigger(id, "changed", msg, sid);
			debug("sendMessage id=" + id + " msg=" + msg);
		}
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void debug(String msg)
	{
		if (debugOutput)
		{
			System.out.println("[CacheServlet] " + new Date().toString() + ": " + msg);
		}
	}

	/**
	 * Cache entry definition.
	 */
	public static class CacheEntry implements Serializable
	{
		/**
		 * Holds the next version.
		 */
		private String next;

		/**
		 * Holds the data.
		 */
		private String data;

		/**
		 * Holds the optional secret.
		 */
		private String secret;

		/**
		 * Returns the next version.
		 */
		public String getNext()
		{
			return next;
		}

		/**
		 * Returns the data.
		 */
		public String getData()
		{
			return data;
		}

		/**
		 * Returns the data.
		 */
		public String getSecret()
		{
			return secret;
		}

		/**
		 * Constructs a new cache entry.
		 */
		public CacheEntry(String next, String data, String secret)
		{
			this.next = next;
			this.data = data;
			this.secret = secret;
		}

	}

	/**
	 * Cache entry definition.
	 */
	public static class UnauthorizedException extends Exception
	{
	}

	/**
	 * Cache entry definition.
	 */
	public static class IncompleteChainException extends Exception
	{
	}

}

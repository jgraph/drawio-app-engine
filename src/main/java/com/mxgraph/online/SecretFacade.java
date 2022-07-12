package com.mxgraph.online;

import com.google.cloud.secretmanager.v1.AccessSecretVersionResponse;
import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import com.google.cloud.secretmanager.v1.SecretVersionName;
import javax.servlet.ServletContext;

public class SecretFacade 
{
    private static final boolean DEBUG = false;
    private static String PROJECT_ID = DEBUG? "praxis-deck-767" : System.getProperty("com.google.appengine.application.id");
    private SecretFacade() { }

    public static String getSecret(String key, ServletContext servletContext) 
    {
        String secret = null;
        try
		{
			SecretManagerServiceClient client = SecretManagerServiceClient.create();
			SecretVersionName vName = SecretVersionName.of(PROJECT_ID, key, "latest");
			AccessSecretVersionResponse ver = client.accessSecretVersion(vName);
            client.close();
			secret = ver.getPayload().getData().toString("utf8");
		}
		catch (Exception e)
		{
			// Fallback to files
            try
			{
				secret = Utils.readInputStream(servletContext
								.getResourceAsStream("/WEB-INF/secrets/" + key))
						        .replaceAll("\n", "");
			}
			catch (Exception e2)
			{
				throw new RuntimeException("Reading secret " + key + " failed.");
			}
		}

        return secret;
    }
}

package com.mxgraph.online;

import javax.servlet.ServletContext;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;	

import org.apache.commons.lang3.exception.ExceptionUtils;

public class SecretFacade 
{
	static private Region region = Region.of(System.getenv("secretsMgrRegion"));

    private SecretFacade() { }

    public static String getSecret(String key, ServletContext servletContext) 
    {
		try
		{
			// Create a Secrets Manager client
			SecretsManagerClient client = SecretsManagerClient.builder()
					.region(region)
					.build();

			GetSecretValueRequest getSecretValueRequest = GetSecretValueRequest.builder()
					.secretId(key)
					.build();

			GetSecretValueResponse getSecretValueResponse = client.getSecretValue(getSecretValueRequest);

			return getSecretValueResponse.secretString();
		}
		catch (Exception e)
		{
			throw new RuntimeException("Reading secret " + key + " failed. "); //+ e.getMessage() + ":::" + ExceptionUtils.getStackTrace(e));
		}
    }
}

We're using the Dokuwiki oauthgeneric plugin to authenticate the wiki.

Because Neon's API is a little different we have to do this 1 line patch so that when logging in the system knows how to query the users profile data.

The access token that is returned is the user id and to retreive user account info you need to send a request to the accounts api ie:
https://<orgid>:<apikey>@api.neoncrm.com/v2/accounts/<access_tokem>

The supplied patch changes the user query to match this.

Neon CRM's Oauth (https://developer.neoncrm.com/authenticating-constituents/)

Configuration for the Plugin looks like this:

 - Application UID and Application Secret are the values from the neon oauth page in site configuration.
 - URL to the authentication endpoint is: https://protohaven.app.neoncrm.com/np/oauth/auth?response_type=code&client_id=<applicationUID>&redirect_uri=https://protohaven.org/wiki/doku.php  (replace <applicationUID> with the one mentioned above)
 - Token Endpoint is: https://app.neoncrm.com/np/oauth/token
 - Authorization Method is Query String v1
 - Access to the username in dot notation:  individualAccount.username
 - Access to the full name in dot notation: individualAccount.primaryContact.firstName individualAccount.primaryContact.lastName
 - Access to the user email in dot notation: individualAccount.primaryContact.email1
 - Label to display on the login button: Login with NeonCRM
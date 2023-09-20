// When Tool status changes update reservable status in Booked Scheduler
// Trigger when status field changes on tools.
// https://github.com/protohaven/systems-integration/blob/main/airtable-automations/UpdateBookedStatus.js

//
// Setup:
// -Automation for Tools & Equipment Base that is watching the Current Status field of the Grid view of the Tool Records Table
//
// Input variables to configure:
// - username = api username from airtable
// - password = api password from airtable
// - bookedResourceId = mapped to BookedResourceId in table
// - status = mapped to Current Status in table
// - toolName = mapped to Tool Name in table
//
// - Neon API Specification: https://developer.neoncrm.com/api-v2/#/
// - Airtable Scripting Documentation: https://www.airtable.com/developers/scripting
// - Airtable Scripting API Reference: https://www.airtable.com/developers/scripting/api
// - Airtable Scripting Object Reference: https://www.airtable.com/developers/scripting/guides/record-model


// Get input variables from airtable
let inputVars = input.config();

// Log Intent of the script for easier debug
console.log( Date() + "  Triggered to change status of " + inputVars.ToolName + " to " + inputVars.status)

const baseUrl = "https://reserve.protohaven.org";
let authUrl = baseUrl + "/Web/Services/Authentication/Authenticate"
let updateUrl = baseUrl + "/Web/Services/Resources/" + inputVars.bookedResourceId

// Prepare login post object
let loginPost = {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        username: inputVars.username,
        password: inputVars.password
    }),
}

// Authenticate with booked and get session token
let authResponse = await fetch(authUrl, loginPost)
let auth = await authResponse.json()
//console.debug(auth)

if (!auth.sessionToken) { 
    // We didn't get a session token error the script
    throw auth.message
}

// Determine if the tool needs to be available (1) or unavailable (2)
let bookedStatus = 2
if (inputVars.status.startsWith("Green") || inputVars.status.startsWith("Yellow")){
    bookedStatus = 1
}

// Prepare update post object
let updatePost = {
    method: 'POST',
    headers: {
        'X-Booked-SessionToken': auth.sessionToken, 
        'X-Booked-UserId': auth.userId
    },
    body: JSON.stringify({
        statusId: bookedStatus,
        name: inputVars.toolName, // There is this dumb requirement on the post where it currently requires the tool name and schedule id.
        scheduleId: 1,            // Hopefully this is removed soon I've emailed the maintainer.
    })
}
//console.debug("updatePost",updateUrl, updatePost)
var updateResponse = await fetch(updateUrl, updatePost)
var ur = await updateResponse.json()

if (ur.errors) {
    throw ur.message + " \n " + ur.errors.join()
}

console.log("Update response from Booked: ", ur)

// When Tool status changes update reservable status in Booked Scheduler
// Trigger when status field changes on tools.
//
// Setup:
// -Automation for Tools & Equipment Base that is watching the Current Status field of the Grid view of the Tool Records Table
//
// Input variables to configure:
// - username = api username from airtable
// - password = api password from airtable
// - bookedResourceId = mapped to BookedResourceId in table
// - status = mapped to Current Status in table


// Get credentials from input variables
let inputVars = input.config();

const baseUrl = "https://reserve.protohaven.org";
let authUrl = baseUrl + "/Web/Services/Authentication/Authenticate"
let updateUrl = baseUrl + "/Web/Services/Resources/" + inputVars.bookedResourceId

// Prepare login post
let loginPost = {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
            "username": inputVars.username,
            "password": inputVars.password
        })
}
console.debug("loginPost", loginPost)

// Authenticate and get sesisonToken
let authResponse = await fetch(authUrl, loginPost)
let auth = await authResponse.json()
console.debug("authResponse", authResponse)
console.debug("auth", auth)

if (auth.sessionToken == null) { 
    throw auth.message
}

if (inputVars.status.startsWith("Green") || inputVars.status.startsWith("Yellow")){
    var bookedStatus = 1;
} else {
    var bookedStatus = 2;
}

console.log("Setting " + inputVars.bookedResourceId + " to status " + bookedStatus)

// Prepare update object
let updatePost = {
    method: 'POST',
    headers: {
        "X-Booked-SessionToken": auth.sessionToken, 
        "X-Booked-UserId": auth.userId
    },
    body: JSON.stringify({
        "statusId": bookedStatus
    })
}
console.debug(updatePost)

var updateResponse = await fetch(updateUrl, updatePost)
console.log(updateResponse)
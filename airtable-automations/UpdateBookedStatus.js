const baseUrl = "https://reserve.protohaven.org";

let response = await fetch(baseUrl + "/Web/Services/Authentication/Authenticate", {
    method: 'POST',
    body: JSON.stringify({username: "airtableApiUser", password: "airtableAPI123"}),
    headers: {
        'Content-Type': 'application/json',
    },
});

let resp = await response.json()

let authHeaders = {"X-Booked-SessionToken": resp.sessionToken, "X-Booked-UserId": resp.userId}

let response2 = await fetch(baseUrl + "/Web/Services/Resources/", {
    method: 'GET',
    headers: authHeaders,
});

let resourcesResp = await response2.json()

var resources = {}
for (var r = 0; r < resourcesResp.resources.length; r++) {
    var res = resourcesResp.resources[r]
    resources[res.resourceId] = res
}

function getBookedEquivStatus(airtableStatus){
    // Map the airtable status into a booked status
    // Green/Yellow Status in Airtable -> "Available" in booked
    // Red/Blue Status in Airtable -> "Unvailable" in booked
    if (airtableStatus.startsWith("Green") || airtableStatus.startsWith("Yellow")){
        return 1 // Booked Status Code for Available
    } else {
        return 2 // Booked Status Code for Unvailable
    }
}

let table = base.getTable("Equipment Records")
let view = table.getView("Alphabetized Equipment")

let queryResult = await view.selectRecordsAsync({fields:["Tool Name", "BookedResourceId", "Maintenance Status"]})

for (var i=0; i < resourcesResp.resources.length; i++){
    var equip = queryResult.records[i]
    var bookedId = parseInt(equip.getCellValueAsString("BookedResourceId"))

    if (!isNaN(bookedId)){   
        var currentStatus = resources[bookedId]["statusId"]
        var newStatus = getBookedEquivStatus(equip.getCellValueAsString("Maintenance Status")).toString()
        
        if (currentStatus != newStatus){    

            var body = {
                'statusId': newStatus, 
                'scheduleId': resources[bookedId]["scheduleId"],
                'name': resources[bookedId]["name"]
            }

            var resp3 = await fetch(baseUrl + "/Web/Services/Resources/" + bookedId, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: authHeaders,
            });

            var updateResp = await resp3.json()
            console.log(updateResp)

        }
        
    }

}
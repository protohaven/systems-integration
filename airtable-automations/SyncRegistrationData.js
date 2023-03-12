// SyncRegistrationData.js
// Sync Class Registration  Data on a schedule
//
// Setup:
// - Create an empty "Class Attendees" table in the Neon base
//
// Input variables to configure:
// - encodedapikey = b64 encoded api key for neon


async function getPaginatedData(endpoint, dataKey, headers) {
    // Get all pages of neon data from the endpoint
    // Parameters:
    //    endpoint - API endpoint(ex: "/accounts?userType=INDIVIDUAL")
    //    dataKey - key of data in response dict (ex: "accounts")

    var allData = []
    var currentPage = 0
    var totalPages = 1 // there should be at least 1 page of data so the loop runs once

    while (currentPage < totalPages) {

        var respData = await fetch(baseUrl + `${endpoint}`, headers)
            .then((response) => response.json())
        //console.debug("respData",respData)
        if (respData["pagination"] ?? "") {
            totalPages = parseInt(respData["pagination"]["totalPages"] ?? 1) // set the total number of pages
        }

        if (respData[dataKey] ?? "") {
            var newData = respData[dataKey]
            allData = allData.concat(newData ?? []) // append the newData to the previous pages
        }
        currentPage += 1

        // Update the currentPage in the body of POST requests
        if (headers["method"] == "POST") {
            let body = JSON.parse(headers["body"])
            body["pagination"]["currentPage"] = currentPage
            headers["body"] = JSON.stringify(body)
        }

    }
    return allData
}

async function deleteRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an deleteRecordsAsync
    for ( var batch of recordQueue){
      console.debug("Delete Batch", batch)
      await attendeeTable.deleteRecordsAsync(batch)
    }
  }

async function createRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an createRecordsAsync
    for (var batch of recordQueue){
        console.debug("Create Batch", batch)
        await attendeeTable.createRecordsAsync(batch)
    }
}

// Get imput vars from Air Table
let inputVars = input.config();
const baseUrl = "https://api.neoncrm.com/v2";

let authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + inputVars.encodedapikey
}

// Create memberMap array
// - the key is the neon member id
// - the value is the air table member record id.
let membersTable = base.getTable("Members");
existingMembers = await membersTable.selectRecordsAsync(
    {"fields": [ "Id" ]}
)
var memberMap = []
for (let member of existingMembers.records){
    memberMap[member.getCellValueAsString("Id")] = member.id
}


// Load Class Registrations from Air Table
let attendeeTable = base.getTable("Class Attendees")
let existingAttendees = await attendeeTable.selectRecordsAsync(
    {"fields": ["Class", "Attendee", "classId", "memberId" ]}
)

// Load Upcoming Classes from Air Table
let classesTable = base.getTable("Classes");
let upcomingClassesView = classesTable.getView("Upcoming Classes");
let existingClasses = await upcomingClassesView.selectRecordsAsync(
    {"fields": [ "Id" ]}
)

// For the upcoming classes query Neon for attendes and Build an array of objects that shows the registrations.
var registrantMap = []
for (let event of existingClasses.records){
    // The values we're going to use regarding events
    let eventId = event.getCellValueAsString("Id")
    let eventRecordId = event.id
    //console.debug("eventdata", eventId, eventRecordId)

    // for each class in the table pull the attendee data from Neon  
    var attendeeData = await getPaginatedData("/events/" + eventId + "/attendees", "attendees", {method: 'GET',headers: authHeaders})
    //console.debug("attendeedata",attendeeData)
    for (let attendee of attendeeData){
        // The values were going to use regarding attendees.
        let attendeeMemberId = attendee.accountId
        let attendeeMemberRecordId = memberMap[attendeeMemberId]
        registrantMap.push({eventId, eventRecordId, attendeeMemberId, attendeeMemberRecordId})
    }
}

console.log("Found " + existingClasses.records.length + " upcoming classes with " + registrantMap.length + " registrations")

// Find Air Table Registrations not in Neon and Remove them
let deleteQueue = []
let deleteBatch = []
for ( let registration of existingAttendees.records){
    let registrationClassId = registration.getCellValue("classId")
    let registrationMemberId = registration.getCellValue("memberId")
    let unfoundRecord = true
    
    for (let record of registrantMap) {
        //console.debug(registrationClassId , record.eventId,registrationMemberId, record.attendeeMemberId)
        if ((registrationClassId == record.eventId) && (registrationMemberId == record.attendeeMemberId)) {
            unfoundRecord = false
        }
    }
    if (unfoundRecord == true) {
        let deleteRegistrationInfo = registration
        deleteBatch = deleteBatch.concat(deleteRegistrationInfo)       
    }
    if (deleteBatch.length == 50){
        deleteQueue = deleteQueue.concat({deleteBatch})
        deleteBatch = []
    }
}
deleteQueue = deleteQueue.concat([deleteBatch])
await deleteRecordsFromQueue(deleteQueue)
console.log("Deleted records:", deleteQueue)

// Find Neon Data registrations not in Air Table and add them.
let createQueue = []
let createBatch = []
for (let record of registrantMap) {
    let unfoundRecord = true

    for (let registration of existingAttendees.records) {
        let registrationClassId = registration.getCellValue("classId")
        let registrationMemberId = registration.getCellValue("memberId")

        //console.debug(registrationClassId , record.eventId,registrationMemberId , record.attendeeMemberId)
        if ((registrationClassId == record.eventId) && (registrationMemberId == record.attendeeMemberId)) {

            unfoundRecord = false
        }
    }
    if (unfoundRecord == true){
        let recordfields = {}
        recordfields["Class"] = [ {id: record.eventRecordId }]
        recordfields["Attendee"] = [{ id: record.attendeeMemberRecordId }]
        createBatch = createBatch.concat({
            fields: recordfields
        })
    }
    if (createBatch.length == 50){
        createQueue = createQueue.concat([createBatch])
        createBatch = []
    }
}
createQueue = createQueue.concat([createBatch])
await createRecordsFromQueue(createQueue)
console.log("Inserted new records: ", createQueue)

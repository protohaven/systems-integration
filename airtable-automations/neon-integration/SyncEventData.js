// SyncEventData.js
// Sync Class Data on a schedule
//
// Setup:
// - Create an empty "Classes" table in the Neon base
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

function formatEntry(eventData){
  // format eventData into correctly labeled entry for insertion into the classes table

  let entry = {}

  entry["Id"] = parseInt(eventData["Event ID"])
  entry["Name"] = eventData["Event Name"]
  entry["summary"] = eventData["Event Summary"]
  entry["registrantCount"] = parseInt(eventData["Event Registration Attendee Count"])
  entry["maximumAttendees"] = parseInt(eventData["Event Capacity"])
  entry["startDate"] = eventData["Event Start Date"]
  entry["endDate"] = eventData["Event End Date"]
  entry["startTime"] = eventData["Event Start Time"]
  entry["endTime"] = eventData["Event End Time"]
  entry["Archived"] = eventData["Event Archive"]
  entry["registrationOpenDate"] = ""

  let eventDate = new Date(eventData["Event Start Date"])
  eventDate.setDate(eventDate.getDate() - 1)
  entry["registrationEndDate"] = eventDate.toISOString().split('T')[0]
  

  entry["adminPage"] = `https://protohaven.app.neoncrm.com/np/admin/event/eventDetails.do?id=${entry["Id"]}`
  entry["eventPage"] = `https://protohaven.app.neoncrm.com/np/clients/protohaven/event.jsp?event=${entry["Id"]}`
  

  return entry
}

async function deleteRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an deleteRecordsAsync
for ( var batch of recordQueue){
  console.debug("Delete Batch", batch)
  await classesTable.deleteRecordsAsync(batch)
}
}

async function createRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an createRecordsAsync

for (var batch of recordQueue){
  console.debug("Create Batch", batch)
  await classesTable.createRecordsAsync(batch)
}

}

async function updateRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an updateRecordsAsync

for (var batch of recordQueue){
  console.debug("Update Batch", batch)
  await classesTable.updateRecordsAsync(batch)
}

}

let inputVars = input.config();
const baseUrl = "https://api.neoncrm.com/v2";

let authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': 'Basic ' + inputVars.encodedapikey
}

let classesTable = base.getTable("Classes")
let upcomingView = classesTable.getView("Upcoming Classes");

// Get All Events for the next 3 weeks

let date = new Date()
date.setDate(date.getDate() - 2);
let yesterdayStr = date.toISOString().split('T')[0]

date.setDate(date.getDate() + 21);
let twoWeeksOutStr = date.toISOString().split('T')[0]

let eventSearchHeaders = {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify(
      {
          'searchFields': [
              {
                  'field': 'Event End Date',
                  'operator': 'GREATER_THAN',
                  'value': yesterdayStr
              },
              {
                  'field': 'Event Start Date',
                  'operator': 'LESS_THAN',
                  'value': twoWeeksOutStr
              }
          ],
          'outputFields': [
              'Event ID',
              'Event Name',
              'Event Summary',
              'Event Start Date',
              'Event Start Time',
              'Event End Date',
              'Event End Time',
              'Event Capacity',
              'Event Archive',
              'Event Registration Attendee Count',
              'Campaign Start Date',
              'Campaign End Date'
          ],
          'pagination': {
              'currentPage': 0,
              'pageSize': 200 
          }
      })
}

var eventData = await getPaginatedData("/events/search", "searchResults", eventSearchHeaders)

// create a dict to easily do updates
var eventInfo = {}
for (var event of eventData){
eventInfo[event["Event ID"]] = formatEntry(event)
}

// grab the existing classes
var existingClasses = await upcomingView.selectRecordsAsync(
{"fields": 
  [
    "Id",
    "Name",
    "summary",
    "registrantCount",
    "maximumAttendees",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "registrationOpenDate",
    "registrationEndDate",
    "eventPage",
    "Clearances Granted"
  ]
}
)

console.debug("Building Delete Batch")
let deleteQueue = []
let deleteBatch = []
for (event of existingClasses.records){
let classId = event.getCellValueAsString("Id")

if(!eventInfo[classId]){
  let deleteMemberInfo = event
  deleteBatch = deleteBatch.concat(deleteMemberInfo)
}
if (deleteBatch.length == 50){
  deleteQueue = deleteQueue.concat([deleteBatch])
  deleteBatch = []
}
}
deleteQueue = deleteQueue.concat([deleteBatch])
await deleteRecordsFromQueue(deleteQueue)
console.log("Deleted records:")
console.log(deleteQueue)

// grab the existing classes
existingClasses = await upcomingView.selectRecordsAsync(
{"fields": 
  [
    "Id",
    "Name",
    "summary",
    "registrantCount",
    "maximumAttendees",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "registrationOpenDate",
    "registrationEndDate",
    "eventPage",
    "Clearances Granted"
  ]
}
)

// update all existing entries in the table
let updateBatch = []
let updateQueue = []
console.debug("Building Update Batch")
for (var classInfo of existingClasses.records){
let classId = classInfo.getCellValueAsString("Id")
let updatedEventInfo = {
  id: classInfo.id,
  fields: eventInfo[classId]
}

delete eventInfo[classId]

updateBatch = updateBatch.concat(updatedEventInfo)
if (updateBatch.length == 50){
  updateQueue = updateQueue.concat([updateBatch])
  updateBatch = []
}

}
updateQueue = updateQueue.concat([updateBatch])
await updateRecordsFromQueue(updateQueue)
console.log("Updated records:")
console.log(updateQueue)

// Insert new class entries into the table
let createQueue = []
let createBatch = []
console.debug("Building Create Batch")
for (event in eventInfo) {
createBatch = createBatch.concat(
  {
    fields: eventInfo[event]
  }
)
if (createBatch.length == 50){
  createQueue = createQueue.concat([createBatch])
  createBatch = []
}
}
createQueue = createQueue.concat([createBatch])

await createRecordsFromQueue(createQueue)
console.log("Inserted new records:")
console.log(createQueue)
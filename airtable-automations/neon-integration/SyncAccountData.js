// SyncAccountData.js
// Sync Member Data on a schedule
//
// Setup:
// -Automation for Tools & Equipment Base that is watching the Current Status field of the Grid view of the Tool Records Table
//
// Input variables to configure:
// - apikey = api key for neon


async function getPaginatedData(endpoint, dataKey, headers){
  // Get all pages of neon data from the endpoint
  // Parameters:
  //    endpoint - API endpoint(ex: "/accounts?userType=INDIVIDUAL")
  //    dataKey - key of data in response dict (ex: "accounts")

  var allData = []
  var currentPage = 0
  var totalPages = 1 // there should be at least 1 page of data so the loop runs once

  while (currentPage < totalPages){

    var respData = await fetch(baseUrl + `${endpoint}`, headers)
      .then((response) => response.json())

    if (respData["pagination"] ?? ""){
        totalPages = parseInt(respData["pagination"]["totalPages"] ?? 1) // set the total number of pages
      }
    
    if (respData[dataKey] ?? ""){
      var newData = respData[dataKey]
      allData = allData.concat( newData ?? []) // append the newData to the previous pages
    }
    currentPage += 1
    
    // Update the currentPage in the body of POST requests
    if (headers["method"] == "POST"){
      let body = JSON.parse(headers["body"])
      body["pagination"]["currentPage"] = currentPage
      headers["body"] = JSON.stringify(body)
    }
    
  }
  return allData
}

function formatEntry(memberData){
  // format memberData into correctly labeled entry for insertion into the members table

  let entry = {}

  entry["Id"] = parseInt(memberData["Account ID"])
  entry["firstName"] = memberData["First Name"]
  entry["lastName"] = memberData["Last Name"]
  entry["email"] = memberData["Email 1"]
  entry["company"] = memberData["Company Name"]

  var status = memberData["Account Current Membership Status"]
  if (status == ""){
    status = "Inactive"
  }
  entry["membershipStatus"] = status
  
  return entry
}

async function updateRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an updateRecordsAsync

  for (var batch of recordQueue){
    await membersTable.updateRecordsAsync(batch)
  }

}

async function createRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an createRecordsAsync

  for (var batch of recordQueue){
    await membersTable.createRecordsAsync(batch)
  }

}

let inputVars = input.config();
const baseUrl = "https://api.neoncrm.com/v2";

let authHeaders = { 
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + inputVars.encodedapikey
    }

let getHeaders = {
    method: 'GET',
    headers: authHeaders,
}

// Get All Accounts

let memberSearchHeaders = {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    "searchFields": [
      {
        "field": "Account ID",
        "operator": "NOT_BLANK",
      }
    ],
    "outputFields": [
      "Account ID",
      "First Name",
      "Last Name",
      "Company Name",
      "Email 1",
      "Account Current Membership Status"
    ],
    "pagination": {
      "currentPage": 0,
      "pageSize": 200,
    }
  })
}

var membershipData = await getPaginatedData("/accounts/search", "searchResults", memberSearchHeaders)

var membershipInfo = {}
for (var member of membershipData){
  membershipInfo[member["Account ID"]] = formatEntry(member)
}

let membersTable = base.getTable("Members")

// grab the existing users
let existingMembers = await membersTable.selectRecordsAsync(
  {"fields": 
    [
      "Member", 
      "Id",
      "firstName",
      "lastName",
      "company",
      "email",
      "membershipStatus"
    ]
  }
)

// update information for all existing members
let updateQueue = []
let updateBatch = []

for (member of existingMembers.records){
  let memberNeonId = member.getCellValueAsString("Id")
  let updatedMemberInfo = {
    id: member.id,
    fields: membershipInfo[memberNeonId]
  }
  delete (membershipInfo[memberNeonId])
  updateBatch = updateBatch.concat(updatedMemberInfo)
  if (updateBatch.length == 50){
    updateQueue = updateQueue.concat([updateBatch])
    updateBatch = []
  }
}
updateQueue = updateQueue.concat([updateBatch])

// Insert new entries into the table
let createQueue = []
let createBatch = []
for (member in membershipInfo) {
  createBatch = createBatch.concat(
    {
      fields: membershipInfo[member]
    }
  )
  if (createBatch.length == 50){
    createQueue = createQueue.concat([createBatch])
    createBatch = []
  }
}
createQueue = createQueue.concat([createBatch])

//process updates
await updateRecordsFromQueue(updateQueue)
console.log("Updated records:")
console.log(updateQueue)

//process insertions
await createRecordsFromQueue(createQueue)
console.log("Inserted new records:")
console.log(createQueue)


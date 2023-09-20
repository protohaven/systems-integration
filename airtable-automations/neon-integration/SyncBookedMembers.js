// SyncMemberData.js
// Keep the active member status synced with the Booked group
// https://github.com/protohaven/systems-integration/blob/main/airtable-automations/SyncBookedMembers.js
//
// Setup:
// 
//
// Input variables to configure:
// - username = api username from airtable
// - password = api password from airtable
//
// - Booked API Specification: https://www.bookedscheduler.com/api/
// - Airtable Scripting Documentation: https://www.airtable.com/developers/scripting
// - Airtable Scripting API Reference: https://www.airtable.com/developers/scripting/api
// - Airtable Scripting Object Reference: https://www.airtable.com/developers/scripting/guides/record-model


async function updateRecordsFromQueue(recordQueue){
// The record queue contains batches of 50 so that we can do an updateRecordsAsync

    for (var batch of recordQueue){
    console.debug("Update Batch", batch)
    await membersTable.updateRecordsAsync(batch)
    }

}

// Get credentials from input variables
let inputVars = input.config();

const baseUrl = "https://reserve.protohaven.org";
let authUrl = baseUrl + "/Web/Services/Authentication/Authenticate"

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

// Authenticate and get sesisonToken
let authResponse = await fetch(authUrl, loginPost)
let auth = await authResponse.json()

if (auth.sessionToken == null) { 
    throw auth.message
}

let usersUrl = baseUrl + "/Web/Services/Users/"

let usersRequest = {
    method: 'GET',
    headers: {
        "X-Booked-SessionToken": auth.sessionToken, 
        "X-Booked-UserId": auth.userId
    },
}

// Grab the bookedIds for of the users currently in Booked
let users = await fetch(usersUrl, usersRequest)

let bookedUserData = await users.json()

let bookedIds = {}
for (var user of bookedUserData["users"]){
    var userEmail = user["emailAddress"].toLowerCase()
    bookedIds[userEmail] = user["id"]
}

let membersTable = base.getTable("Members")
var existingMembers = await membersTable.selectRecordsAsync(
    {"fields": 
    [
        "Member", 
        "Id",
        "bookedMemberId",
        "firstName",
        "lastName",
        "company",
        "email",
        "membershipType",
        "membershipStatus"
    ]
    }
)

// grab members who don't have a booked Id and update their bookedIds if they have one now
let membersMissingBookedIds = existingMembers.records.filter(member => {
    return member.getCellValue('bookedMemberId') == null
})

let updateBatch = []
let updateQueue = []
let activeMemberIds = []
for (var member of membersMissingBookedIds){
    var memberEmail = member.getCellValue("email")
    if(memberEmail){
        let memberBookedId = bookedIds[memberEmail.toLowerCase()]
        if (memberBookedId){
            let updatedMemberInfo = {
                id: member.id,
                fields: {
                "bookedMemberId": parseInt(memberBookedId)
                }
            }
            updateBatch = updateBatch.concat(updatedMemberInfo)
        }
        
        if (updateBatch.length == 50){
        updateQueue = updateQueue.concat([updateBatch])
        updateBatch = []
        }
        
    }

}
updateQueue = updateQueue.concat([updateBatch])
await updateRecordsFromQueue(updateQueue)
console.log("Updated records:")
console.log(updateQueue)


// Grab all of the active members that have an assigned bookedId
let activeMemberBookedIds = existingMembers.records.filter(member => {
    return (member.getCellValue('bookedMemberId') != null && member.getCellValue('membershipStatus') == "Active")
})

activeMemberIds = []
for (var activeMember of activeMemberBookedIds){
    activeMemberIds = activeMemberIds.concat(activeMember.getCellValue('bookedMemberId'))
}

// Update the members group in booked with active members
let bookedMembers = {
    "userIds": activeMemberIds
}

// let memberGroupId = "12"
// let testmembersGroupId = "52"
// let groupUrl = baseUrl + `/Web/Services/Groups/${testmembersGroupId}/Users`

// let groupPost = {
//     method: 'POST',
//     headers: {
//         "X-Booked-SessionToken": auth.sessionToken, 
//         "X-Booked-UserId": auth.userId
//     },
//     body: JSON.stringify(bookedMembers)
// }

// let groups = await fetch(groupUrl, groupPost)
// let groupsResp = await groups.json()
// console.log(groupsResp["message"])


let testmembersGroupId = "52"
let groupUrl = baseUrl + `/Web/Services/Groups/${testmembersGroupId}`

let groupPost = {
    method: 'GET',
    headers: {
        "X-Booked-SessionToken": auth.sessionToken, 
        "X-Booked-UserId": auth.userId
    },
}

let groups = await fetch(groupUrl, groupPost)
let groupsResp = await groups.json()
let users1 = groupsResp.users

let membersGroupId = "12"
let groupUrl2 = baseUrl + `/Web/Services/Groups/${membersGroupId}`
let groups2 = await fetch(groupUrl2, groupPost)
let groupsResp2 = await groups2.json()
let users2 = groupsResp2.users

let users2Ids = []
for (var u of users2){
    users2Ids = users2Ids.concat(u.replace("/Web/Services/Users/", ""))
}

let diff = users2.filter(x => !users1.includes(x))


let diffUsers = bookedUserData.users.filter(x => diff.includes(`/Web/Services/Users/${x.id}`))

function compare( a, b ) {
    if ( a.lastName < b.lastName ){
    return -1;
    }
    if ( a.lastName > b.lastName ){
    return 1;
    }
    return 0;
}

diffUsers.sort( compare );

// console.log(JSON.stringify(diffUsers))

let names = []
for (var member of existingMembers.records){
    var memberName = member.getCellValue("Member")
    if (member.getCellValue("membershipStatus") == "Active"){
        names = names.concat(memberName.toLowerCase())
    }
}
names.sort()
console.log(names)

let missingUsers = diffUsers.filter(x => names.includes(`${x.firstName.toLowerCase()} ${x.lastName.toLowerCase()}`))
console.log(missingUsers)

// for (var x of diffUsers) {
//     console.log(`${x.firstName.toLowerCase()} ${x.lastName.toLowerCase()}`)
// }

let unregisteredUsers = diffUsers.filter(x => !names.includes(`${x.firstName.toLowerCase()} ${x.lastName.toLowerCase()}`))
console.log(JSON.stringify(missingUsers))
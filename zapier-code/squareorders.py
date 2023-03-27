# When multiple items are on the same order they come in with comma separated fields, ugh.
# Also the customer name isn't in the same spot.  This script gets us just the storage
# info that we need.
#
# Inputs:
#
# name1 = Customer Given Name Customer Family Name
# name2 = Tenders Payment…omer Given Name Tenders Payment…mer Family Name
# name3 = Tenders Payment…Cardholder
# email1 = Customer Email Address
# email2 = Tenders Payment…r Email Address
# items  = Line Items Name
# quantities = Line Items Quantity
# variations = Line Items Variation Name
# amounts = Line Items Base…mount Formatted
# sums = Line Items Gros…mount Formatted


import re

# Name and Email can be in several different fields.   Prefer custmer name / email over tenders
name = "Unknown Name"
if "name1" in input_data.keys():
    name = input_data["name1"]
elif "name2" in input_data.keys():
    name = input_data["name2"]
elif "name3" in input_data.keys():
    name = input_data["name3"]

email = "Unknown Email"
if "email1" in input_data.keys():
    email = input_data["email1"]
elif "email2" in input_data.keys():
    email = input_data["email2"]


# Each of the following values are comma seperated lists indexed in the same order.
# Lets isolate storage orders.
items = []
if "items" in input_data.keys():
    items = input_data["items"].split(",")
listlength = len(items)

quantities = [None] * listlength
if "quantities" in input_data.keys():
    quantities = input_data["quantities"].split(",")

variations = [None] * listlength
if "variations" in input_data.keys():
    variations = input_data["variations"].split(",")

amounts = [None] * listlength
if "amounts" in input_data.keys():
    amounts = input_data["amounts"].split(",")

sums = [None] * listlength
if "sums" in input_data.keys():
    sums = input_data["sums"].split(",")


output = []
for i in range(len(items)):
    if re.search("storage", items[i], flags=re.IGNORECASE):
        output.append(
            {
                "name": name,
                "email": email,
                "item": items[i],
                "variation": variations[i],
                "quantity": quantities[i],
                "sum": sums[i],
            }
        )

return output

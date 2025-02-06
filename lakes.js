document.addEventListener('DOMContentLoaded', async function () {
    const currentDateTime = new Date();
    console.log("currentDateTime: ", currentDateTime);

    let setLocationCategory = null;
    let setLocationGroupOwner = null;
    let setTimeseriesGroup1 = null;
    let setTimeseriesGroup2 = null;
    let setTimeseriesGroup3 = null;
    let setLookBackHours = null;
    let setReportDiv = null;

    console.log("********************* lakes *******************");
    // Set the category and base URL for API calls
    setReportDiv = "lakes";
    setLocationCategory = "Lakes";
    setLocationGroupOwner = "Project";
    setTimeseriesGroup1 = "Stage";
    setTimeseriesGroup2 = "Control-Point";
    setTimeseriesGroup3 = "Conc-DO";
    setLookBackHours = subtractHoursFromDate(new Date(), 6);

    // Display the loading indicator for water quality alarm
    const loadingIndicator = document.getElementById(`loading_${setReportDiv}`);
    loadingIndicator.style.display = 'block'; // Show the loading indicator

    console.log("setLocationCategory: ", setLocationCategory);
    console.log("setLocationGroupOwner: ", setLocationGroupOwner);
    console.log("setTimeseriesGroup1: ", setTimeseriesGroup1);
    console.log("setTimeseriesGroup2: ", setTimeseriesGroup2);
    console.log("setTimeseriesGroup3: ", setTimeseriesGroup3);

    console.log("setLookBackHours: ", setLookBackHours);

    let setBaseUrl = null;
    if (cda === "internal") {
        setBaseUrl = `https://wm.${office.toLowerCase()}.ds.usace.army.mil:8243/${office.toLowerCase()}-data/`;
        // console.log("setBaseUrl: ", setBaseUrl);
    } else if (cda === "public") {
        setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
        // console.log("setBaseUrl: ", setBaseUrl);
    }

    // Define the URL to fetch location groups based on category
    const categoryApiUrl = setBaseUrl + `location/group?office=${office}&include-assigned=false&location-category-like=${setLocationCategory}`;
    // console.log("categoryApiUrl: ", categoryApiUrl);

    // Initialize maps to store metadata and time-series ID (TSID) data for various parameters
    const ownerMap = new Map();
    const tsidStageMap = new Map();
    const tsidControlPointMap = new Map();
    const tsidDoMap = new Map();

    // Initialize arrays for storing promises
    const ownerPromises = [];
    const stageTsidPromises = [];
    const controlPointTsidPromises = [];
    const doTsidPromises = [];

    // Fetch location group data from the API
    fetch(categoryApiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                console.warn('No data available from the initial fetch.');
                return;
            }

            // Filter and map the returned data to basins belonging to the target category
            const targetCategory = { "office-id": office, "id": setLocationCategory };
            const filteredArray = filterByLocationCategory(data, targetCategory);
            let basins = filteredArray.map(item => item.id);
            // console.log("basins: ", basins);

            // Set basins to current basin if set in the url
            // basins = basins.filter(basinId => basin.includes(basinId));
            // console.log("basins: ", basins);

            if (basins.length === 0) {
                console.warn('No basins found for the given category.');
                return;
            }

            // Initialize an array to store promises for fetching basin data
            const apiPromises = [];
            let combinedData = [];

            // Loop through each basin and fetch data for its assigned locations
            basins.forEach(basin => {
                const basinApiUrl = setBaseUrl + `location/group/${basin}?office=${office}&category-id=${setLocationCategory}`;
                // console.log("basinApiUrl: ", basinApiUrl);

                apiPromises.push(
                    fetch(basinApiUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Network response was not ok for basin ${basin}: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(getBasin => {
                            // console.log('getBasin:', getBasin);

                            if (!getBasin) {
                                // console.log(`No data for basin: ${basin}`);
                                return;
                            }

                            // Filter and sort assigned locations based on 'attribute' field
                            getBasin[`assigned-locations`] = getBasin[`assigned-locations`].filter(location => location.attribute <= 900);
                            getBasin[`assigned-locations`].sort((a, b) => a.attribute - b.attribute);
                            combinedData.push(getBasin);

                            // If assigned locations exist, fetch metadata and time-series data
                            if (getBasin['assigned-locations']) {
                                getBasin['assigned-locations'].forEach(loc => {
                                    // Fetch data
                                    (() => {
                                        // Fetch owner
                                        (() => {
                                            // Fetch owner for each location
                                            let ownerApiUrl = setBaseUrl + `location/group/${setLocationGroupOwner}?office=${office}&category-id=${office}`;
                                            // console.log("ownerApiUrl: ", ownerApiUrl);
                                            if (ownerApiUrl) {
                                                ownerPromises.push(
                                                    fetch(ownerApiUrl)
                                                        .then(response => {
                                                            if (response.status === 404) {
                                                                console.warn(`Datman TSID data not found for location: ${loc['location-id']}`);
                                                                return null;
                                                            }
                                                            if (!response.ok) {
                                                                throw new Error(`Network response was not ok: ${response.statusText}`);
                                                            }
                                                            return response.json();
                                                        })
                                                        .then(ownerData => {
                                                            if (ownerData) {
                                                                // console.log("ownerData", ownerData);
                                                                ownerMap.set(loc['location-id'], ownerData);
                                                            }
                                                        })
                                                        .catch(error => {
                                                            console.error(`Problem with the fetch operation for stage TSID data at ${ownerApiUrl}:`, error);
                                                        })
                                                );
                                            }
                                        })();

                                        // Fetch tsid
                                        (() => {
                                            // Fetch datman TSID data
                                            const tsidStageApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup1}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidStageApiUrl:', tsidStageApiUrl);
                                            stageTsidPromises.push(
                                                fetch(tsidStageApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(tsidData => {
                                                        // // console.log('tsidData:', tsidData);
                                                        if (tsidData) {
                                                            tsidStageMap.set(loc['location-id'], tsidData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidStageApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch tsid 2
                                        (() => {
                                            const tsidHingePointApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup2}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidHingePointApiUrl:', tsidHingePointApiUrl);
                                            controlPointTsidPromises.push(
                                                fetch(tsidHingePointApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            tsidControlPointMap.set(loc['location-id'], data);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidHingePointApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch tsid 3
                                        (() => {
                                            const tsidDoApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup3}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidDoApiUrl:', tsidDoApiUrl);
                                            doTsidPromises.push(
                                                fetch(tsidDoApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            tsidDoMap.set(loc['location-id'], data);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidDoApiUrl}:`, error);
                                                    })
                                            );
                                        })();
                                    })();
                                });
                            }
                        })
                        .catch(error => {
                            console.error(`Problem with the fetch operation for basin ${basin}:`, error);
                        })
                );
            });

            // Process all the API calls and store the fetched data
            Promise.all(apiPromises)
                .then(() => Promise.all(ownerPromises))
                .then(() => Promise.all(stageTsidPromises))
                .then(() => Promise.all(controlPointTsidPromises))
                .then(() => Promise.all(doTsidPromises))
                .then(() => {
                    combinedData.forEach(basinData => {
                        if (basinData['assigned-locations']) {
                            basinData['assigned-locations'].forEach(loc => {

                                const reorderByAttribute = (data) => {
                                    data['assigned-time-series'].sort((a, b) => a.attribute - b.attribute);
                                };

                                // Append metadata and tsid
                                (() => {
                                    // Append owner
                                    const ownerMapData = ownerMap.get(loc['location-id']);
                                    if (ownerMapData) {
                                        loc['owner'] = ownerMapData;
                                    }

                                    // Append tsid 1
                                    const tsidStageMapData = tsidStageMap.get(loc['location-id']);
                                    if (tsidStageMapData) {
                                        reorderByAttribute(tsidStageMapData);
                                        loc['tsid-stage'] = tsidStageMapData;
                                    } else {
                                        loc['tsid-stage'] = null;  // Append null if missing
                                    }

                                    // Append tsid 2
                                    const tsidTwMapData = tsidControlPointMap.get(loc['location-id']);
                                    if (tsidTwMapData) {
                                        reorderByAttribute(tsidTwMapData);
                                        loc['tsid-control-point'] = tsidTwMapData;
                                    } else {
                                        loc['tsid-control-point'] = null;
                                    }

                                    // Append tsid 3
                                    const tsidHingePointMapData = tsidDoMap.get(loc['location-id']);
                                    if (tsidHingePointMapData) {
                                        reorderByAttribute(tsidHingePointMapData);
                                        loc['tsid-do'] = tsidHingePointMapData;
                                    } else {
                                        loc['tsid-do'] = null;
                                    }
                                })();
                            });
                        }
                    });

                    console.log('combinedData:', combinedData);

                    // Filter data
                    (() => {
                        // Step 1: Filter out locations where 'attribute' ends with '.1'
                        combinedData.forEach((dataObj, index) => {
                            // console.log(`Processing dataObj at index ${index}:`, dataObj['assigned-locations']);

                            // Filter out locations with 'attribute' ending in '.1'
                            dataObj['assigned-locations'] = dataObj['assigned-locations'].filter(location => {
                                const attribute = location['attribute'].toString();
                                if (attribute.endsWith('.1')) {
                                    // Log the location being removed
                                    // console.log(`Removing location with attribute '${attribute}' and id '${location['location-id']}' at index ${index}`);
                                    return false; // Filter out this location
                                }
                                return true; // Keep the location
                            });

                            // console.log(`Updated assigned-locations for index ${index}:`, dataObj['assigned-locations']);
                        });

                        console.log('Filtered all locations ending with .1 successfully:', combinedData);

                        // Step 2: Filter out locations where 'location-id' doesn't match owner's 'assigned-locations'
                        combinedData.forEach(dataGroup => {
                            // Iterate over each assigned-location in the dataGroup
                            let locations = dataGroup['assigned-locations'];

                            // Loop through the locations array in reverse to safely remove items
                            for (let i = locations.length - 1; i >= 0; i--) {
                                let location = locations[i];

                                // Find if the current location-id exists in owner's assigned-locations
                                let matchingOwnerLocation = location['owner']['assigned-locations'].some(ownerLoc => {
                                    return ownerLoc['location-id'] === location['location-id'];
                                });

                                // If no match, remove the location
                                if (!matchingOwnerLocation) {
                                    // console.log(`Removing location with id ${location['location-id']} as it does not match owner`);
                                    locations.splice(i, 1);
                                }
                            }
                        });

                        console.log('Filtered all locations by matching location-id with owner successfully:', combinedData);

                        // Step 3: Filter out locations where 'tsid-stage' is null
                        combinedData.forEach(dataGroup => {
                            // Iterate over each assigned-location in the dataGroup
                            let locations = dataGroup['assigned-locations'];

                            // Loop through the locations array in reverse to safely remove items
                            for (let i = locations.length - 1; i >= 0; i--) {
                                let location = locations[i];

                                // console.log("tsid-stage: ", location[`tsid-stage`]);

                                // Check if 'tsid-stage' is null or undefined
                                let isLocationNull = location[`tsid-stage`] == null;

                                // If tsid-stage is null, remove the location
                                if (isLocationNull) {
                                    console.log(`Removing location with id ${location['location-id']}`);
                                    locations.splice(i, 1); // Remove the location from the array
                                }
                            }
                        });

                        console.log('Filtered all locations where tsid is null successfully:', combinedData);

                        // Step 4: Filter out basin where there are no gages
                        combinedData = combinedData.filter(item => item['assigned-locations'] && item['assigned-locations'].length > 0);

                        console.log('Filtered all basin where assigned-locations is null successfully:', combinedData);

                        // Step 5: Filter out basin order
                        const sortOrderBasin = ['Mississippi', 'Kaskaskia'];

                        // Sort the combinedData array based on the sortOrderBasin
                        combinedData.sort((a, b) => {
                            const indexA = sortOrderBasin.indexOf(a.id); // Assuming 'id' represents the basin name
                            const indexB = sortOrderBasin.indexOf(b.id); // Assuming 'id' represents the basin name

                            // If both basins are found in the sortOrderBasin, sort based on their indices
                            if (indexA !== -1 && indexB !== -1) {
                                return indexA - indexB; // Sort based on order in sortOrderBasin
                            }
                            // If one is not found, put it at the end
                            return indexA === -1 ? 1 : -1;
                        });

                        // Log the sorted combinedData for verification
                        console.log("Sorted combinedData: ", combinedData);
                    })();

                    const timeSeriesDataPromises = [];

                    // Iterate over all arrays in combinedData
                    for (const dataArray of combinedData) {
                        for (const locData of dataArray['assigned-locations'] || []) {
                            // Handle temperature, depth, and DO time series
                            const stageTimeSeries = locData['tsid-stage']?.['assigned-time-series'] || [];
                            const controlPointTimeSeries = locData['tsid-control-point']?.['assigned-time-series'] || [];
                            const doTimeSeries = locData['tsid-do']?.['assigned-time-series'] || [];

                            // Function to create fetch promises for time series data
                            const timeSeriesDataFetchPromises = (timeSeries, type) => {
                                return timeSeries.map((series, index) => {
                                    const tsid = series['timeseries-id'];
                                    const timeSeriesDataApiUrl = setBaseUrl + `timeseries?page-size=5000&name=${tsid}&begin=${setLookBackHours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;
                                    // console.log('timeSeriesDataApiUrl:', timeSeriesDataApiUrl);

                                    return fetch(timeSeriesDataApiUrl, {
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/json;version=2'
                                        }
                                    })
                                        .then(res => res.json())
                                        .then(data => {

                                            // console.log("data: ", data);

                                            if (data.values) {
                                                data.values.forEach(entry => {
                                                    entry[0] = formatISODate2ReadableDate(entry[0]);
                                                });
                                            }

                                            const hourlyValue = getHourlyData(data, tsid);
                                            // console.log("hourlyValue: ", hourlyValue);

                                            updateLocData(locData, type, data, hourlyValue);
                                        })

                                        .catch(error => {
                                            console.error(`Error fetching additional data for location ${locData['location-id']} with TSID ${tsid}:`, error);
                                        });
                                });
                            };

                            // Create promises for temperature, depth, and DO time series
                            const stagePromises = timeSeriesDataFetchPromises(stageTimeSeries, 'stage');
                            const controlPointPromises = timeSeriesDataFetchPromises(controlPointTimeSeries, 'control-point');
                            const doPromises = timeSeriesDataFetchPromises(doTimeSeries, 'do');

                            // Additional API call for extents data
                            const timeSeriesDataExtentsApiCall = async (type) => {
                                const extentsApiUrl = setBaseUrl + `catalog/TIMESERIES?page-size=5000&office=${office}`;
                                // console.log('extentsApiUrl:', extentsApiUrl);

                                try {
                                    const res = await fetch(extentsApiUrl, {
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/json;version=2'
                                        }
                                    });
                                    const data = await res.json();
                                    locData['extents-api-data'] = data;
                                    locData[`extents-data`] = {};

                                    // Collect TSIDs from temp, depth, and DO time series
                                    const stageTsids = stageTimeSeries.map(series => series['timeseries-id']);
                                    const controlPointTsids = controlPointTimeSeries.map(series => series['timeseries-id']);
                                    const doTsids = doTimeSeries.map(series => series['timeseries-id']);
                                    const allTsids = [...stageTsids, ...controlPointTsids, ...doTsids];

                                    allTsids.forEach((tsid, index) => {
                                        const matchingEntry = data.entries.find(entry => entry['name'] === tsid);
                                        if (matchingEntry) {
                                            // Convert times from UTC
                                            let latestTimeUTC = matchingEntry.extents[0]?.['latest-time'];
                                            let earliestTimeUTC = matchingEntry.extents[0]?.['earliest-time'];

                                            // Convert UTC times to Date objects
                                            let latestTimeCST = new Date(latestTimeUTC);
                                            let earliestTimeCST = new Date(earliestTimeUTC);

                                            // Function to format date as "MM-DD-YYYY HH:mm"
                                            const formatDate = (date) => {
                                                return date.toLocaleString('en-US', {
                                                    timeZone: 'America/Chicago', // Set the timezone to Central Time (CST/CDT)
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false // Use 24-hour format
                                                }).replace(',', ''); // Remove the comma from the formatted string
                                            };

                                            // Format the times to CST/CDT
                                            let formattedLatestTime = formatDate(latestTimeCST);
                                            let formattedEarliestTime = formatDate(earliestTimeCST);

                                            // Construct the _data object with formatted times
                                            let _data = {
                                                office: matchingEntry.office,
                                                name: matchingEntry.name,
                                                earliestTime: formattedEarliestTime, // Use formatted earliestTime
                                                earliestTimeISO: earliestTimeCST.toISOString(), // Store original ISO format as well
                                                lastUpdate: matchingEntry.extents[0]?.['last-update'],
                                                latestTime: formattedLatestTime, // Use formatted latestTime
                                                latestTimeISO: latestTimeCST.toISOString(), // Store original ISO format as well
                                                tsid: matchingEntry['timeseries-id'],
                                            };

                                            // Determine extent key based on tsid
                                            let extent_key;
                                            if (tsid.includes('Stage') || tsid.includes('Elev') || tsid.includes('Flow') || tsid.includes('Conc-DO')) {
                                                extent_key = 'datman';
                                            } else {
                                                return; // Ignore if it doesn't match the condition
                                            }

                                            // Update locData with extents-data
                                            if (!locData[`extents-data`][extent_key]) {
                                                locData[`extents-data`][extent_key] = [_data];
                                            } else {
                                                locData[`extents-data`][extent_key].push(_data);
                                            }

                                        } else {
                                            console.warn(`No matching entry found for TSID: ${tsid}`);
                                        }
                                    });
                                } catch (error) {
                                    console.error(`Error fetching additional data for location ${locData['location-id']}:`, error);
                                }
                            };

                            // Combine all promises for this location
                            timeSeriesDataPromises.push(Promise.all([...stagePromises, ...controlPointPromises, ...doPromises, timeSeriesDataExtentsApiCall()]));
                        }
                    }

                    // Wait for all additional data fetches to complete
                    return Promise.all(timeSeriesDataPromises);
                })
                .then(() => {
                    console.log('All combinedData data fetched successfully (lakes):', combinedData);

                    const table = createTableLakes(combinedData, type, mobile);
                    const container = document.getElementById(`table_container_${setReportDiv}`);
                    container.appendChild(table);

                    loadingIndicator.style.display = 'none';
                })
                .catch(error => {
                    console.error('There was a problem with one or more fetch operations:', error);
                    loadingIndicator.style.display = 'none';
                });
        })
        .catch(error => {
            console.error('There was a problem with the initial fetch operation:', error);
            loadingIndicator.style.display = 'none';
        });

    function filterByLocationCategory(array, setLocationCategory) {
        return array.filter(item =>
            item['location-category'] &&
            item['location-category']['office-id'] === setLocationCategory['office-id'] &&
            item['location-category']['id'] === setLocationCategory['id']
        );
    }

    function subtractHoursFromDate(date, hoursToSubtract) {
        return new Date(date.getTime() - (hoursToSubtract * 60 * 60 * 1000));
    }

    function formatISODate2ReadableDate(timestamp) {
        const date = new Date(timestamp);
        const mm = String(date.getMonth() + 1).padStart(2, '0'); // Month
        const dd = String(date.getDate()).padStart(2, '0'); // Day
        const yyyy = date.getFullYear(); // Year
        const hh = String(date.getHours()).padStart(2, '0'); // Hours
        const min = String(date.getMinutes()).padStart(2, '0'); // Minutes
        return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
    }

    function getHourlyData(data, tsid) {
        const hourlyData = [];

        data.values.forEach(entry => {
            const [timestamp, value, qualityCode] = entry;

            // Normalize the timestamp
            let date;
            if (typeof timestamp === "string") {
                date = new Date(timestamp.replace(/-/g, '/')); // Replace hyphens with slashes for iOS
            } else if (typeof timestamp === "number") {
                date = new Date(timestamp); // Assume it's a UNIX timestamp
            } else {
                console.warn("Unrecognized timestamp format:", timestamp);
                return; // Skip invalid entries
            }

            // Validate date
            if (isNaN(date.getTime())) {
                console.warn("Invalid date:", timestamp);
                return; // Skip invalid dates
            }

            // Check if the time is exactly at the top of the hour
            if (date.getMinutes() === 0 && date.getSeconds() === 0) {
                hourlyData.push({ timestamp, value, qualityCode, tsid });
            }
        });

        return hourlyData;
    }

    function createTableLakes(combinedData, type, mobile) {
        // Create a new table element and set its ID
        const table = document.createElement('table');
        table.setAttribute('id', 'gage_data');

        // Loop through each basin in the combined data
        combinedData.forEach((basin) => {
            // Loop through each assigned location in the basin
            basin['assigned-locations'].forEach((location) => {
                // Create a row for the location ID spanning 6 columns
                const locationRow = document.createElement('tr');
                const locationCell = document.createElement('th');
                locationCell.colSpan = 5; // Set colspan to 6 for location ID
                locationCell.style.backgroundColor = 'darkslategrey'; // Set background color
                locationCell.textContent = (location['location-id']).split('-')[0];
                locationRow.appendChild(locationCell);
                table.appendChild(locationRow); // Append the location row to the table

                // Create a header row for the data columns
                const headerRow = document.createElement('tr');
                const columns = ["Date Time", "Stage (ft)", "Outflow 1 (cfs)", "Outflow 2 (cfs)", "DO (ppm)"];

                // Dynamically set header text for Outflow 1 and Outflow 2
                const controlPointEntry = location['control-point-hourly-value']?.[0]?.[0]; // Assuming the first entry contains the tsid
                const controlPointEntry2 = location['control-point-hourly-value']?.[1]?.[0]; // Assuming the second entry contains the tsid

                // Inline extraction of "Breese" from controlPointTsid
                if (controlPointEntry) {
                    columns[2] = `${controlPointEntry.tsid.split('-')[0]} Flow (cfs)`; // Extract "Breese" directly
                }
                if (controlPointEntry2) {
                    columns[3] = `${controlPointEntry2.tsid.split('-')[0]} Flow (cfs)`; // Extract "Breese" directly
                }

                // Append column headers
                columns.forEach((columnName) => {
                    const th = document.createElement('th');
                    th.textContent = columnName; // Set the header text
                    th.style.backgroundColor = 'darkslategrey'; // Set background color
                    headerRow.appendChild(th); // Append header cells to the header row
                });
                table.appendChild(headerRow); // Append the header row to the table

                const sortedEntries = location['stage-hourly-value'][0].slice().sort((a, b) => {
                    // Convert MM-DD-YYYY HH:mm to YYYY-MM-DDTHH:mm:ss for reliable parsing
                    const normalizeDate = (timestamp) => {
                        const [date, time] = timestamp.split(' ');
                        const [month, day, year] = date.split('-');
                        return `${year}-${month}-${day}T${time}`;
                    };

                    const dateA = new Date(normalizeDate(a.timestamp));
                    const dateB = new Date(normalizeDate(b.timestamp));

                    return dateB - dateA; // Sort descending (latest time first)
                });

                // Loop through sorted stage-hourly-value to add data rows
                sortedEntries.forEach((entry) => {
                    const row = document.createElement('tr'); // Create a new row for each entry

                    const dateTime = entry?.timestamp || "N/A";
                    let dateTimeDisplay = null;
                    if (mobile === true) {
                        dateTimeDisplay = entry?.timestamp || "N/A";
                    } else {
                        dateTimeDisplay = entry?.timestamp || "N/A";
                    }

                    // Check if the current timestamp matches any poolValue timestamp
                    const poolValueEntry = location['stage-hourly-value'][0].find(poolValue => poolValue.timestamp === dateTime);
                    const poolValue = poolValueEntry ? poolValueEntry.value.toFixed(2) : "--";

                    // Match timestamps and grab values for tailWaterValue, controlPointValue, tainterValue, and rollerValue
                    const controlPointEntry = location['control-point-hourly-value']?.[0]?.find(controlPoint => controlPoint.timestamp === dateTime);
                    const controlPointValue = controlPointEntry ? controlPointEntry.value.toFixed(0) : "--";
                    const controlPointTsid = controlPointEntry ? controlPointEntry.tsid : "--";

                    const controlPointEntry2 = location['control-point-hourly-value']?.[1]?.find(controlPoint => controlPoint.timestamp === dateTime);
                    const controlPointValue2 = controlPointEntry2 ? controlPointEntry2.value.toFixed(0) : "--";

                    const doEntry = location['do-hourly-value']?.[0]?.find(_do => _do.timestamp === dateTime);
                    const tainterValue = doEntry && typeof doEntry.value === 'number' ? doEntry.value.toFixed(2) : "--";

                    // Create and append cells to the row for each value
                    [dateTimeDisplay, poolValue, controlPointValue, controlPointValue2, tainterValue].forEach((value) => {
                        const cell = document.createElement('td'); // Create a new cell for each value
                        cell.textContent = value; // Set the cell text
                        row.appendChild(cell); // Append the cell to the row
                    });

                    // Append the data row to the table
                    table.appendChild(row);
                });

                // Add a spacer row after each location's data rows for visual separation
                const spacerRow = document.createElement('tr'); // Create a new row for spacing
                const spacerCell = document.createElement('td'); // Create a cell for the spacer
                spacerCell.colSpan = 6; // Set colspan to 6 for the spacer cell
                spacerCell.style.height = '20px'; // Set height for the spacer
                spacerRow.appendChild(spacerCell); // Append the spacer cell to the spacer row
                table.appendChild(spacerRow); // Append the spacer row to the table
            });
        });

        return table; // Return the completed table
    }

    function updateLocData(locData, type, data, hourlyValue) {
        const keys = {
            apiDataKey: `${type}-api-data`,
            hourlyValueKey: `${type}-hourly-value`
        };

        for (let [key, value] of Object.entries(keys)) {
            if (!locData[value]) {
                locData[value] = [];
            }

            switch (key) {
                case 'apiDataKey':
                    locData[value].push(data);
                    break;
                case 'hourlyValueKey':
                    locData[value].push(hourlyValue);
                    break;
                default:
                    console.error('Unknown key:', key);
            }
        }
    }
});


document.addEventListener('DOMContentLoaded', async function () {
    const currentDateTime = new Date();
    console.log("currentDateTime: ", currentDateTime);

    let setLocationCategory = null;
    let setLocationGroupOwner = null;
    let setTimeseriesGroup1 = null;
    let setTimeseriesGroup2 = null;
    let setTimeseriesGroup3 = null;
    let setTimeseriesGroup4 = null;
    let setTimeseriesGroup5 = null;
    let setLookBackHours = null;
    let setReportDiv = null;

    console.log("********************* ld_gate_summary *******************");
    // Set the category and base URL for API calls
    setReportDiv = "ld_gate_summary";
    setLocationCategory = "Projects";
    setLocationGroupOwner = "Ld-Gate-Summary";
    setTimeseriesGroup1 = "Stage";
    setTimeseriesGroup2 = "Stage-TW";
    setTimeseriesGroup3 = "Hinge-Point";
    setTimeseriesGroup4 = "Tainter";
    setTimeseriesGroup5 = "Roller";
    setLookBackHours = subtractDaysFromDate(new Date(), 1);

    // Display the loading indicator for water quality alarm
    const loadingIndicator = document.getElementById(`loading_${setReportDiv}`);
    loadingIndicator.style.display = 'block'; // Show the loading indicator

    console.log("setLocationCategory: ", setLocationCategory);
    console.log("setLocationGroupOwner: ", setLocationGroupOwner);
    console.log("setTimeseriesGroup1: ", setTimeseriesGroup1);
    console.log("setTimeseriesGroup2: ", setTimeseriesGroup2);
    console.log("setTimeseriesGroup3: ", setTimeseriesGroup3);
    console.log("setTimeseriesGroup4: ", setTimeseriesGroup4);
    console.log("setTimeseriesGroup5: ", setTimeseriesGroup5);
    console.log("setLookBackHours: ", setLookBackHours);

    let setBaseUrl = null;
    if (cda === "internal") {
        setBaseUrl = `https://wm.${office.toLowerCase()}.ds.usace.army.mil/${office.toLowerCase()}-data/`;
    } else if (cda === "internal-coop") {
        setBaseUrl = `https://wm-${office.toLowerCase()}coop.mvk.ds.usace.army.mil/${office.toLowerCase()}-data/`;
    } else if (cda === "public") {
        // setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
        setBaseUrl = `https://cwms.sec.usace.army.mil/cwms-data/`;
    }
    // console.log("setBaseUrl: ", setBaseUrl);

    let setJsonFileBaseUrl = null;
    if (cda === "internal") {
        setJsonFileBaseUrl = `https://wm.mvs.ds.usace.army.mil/`;
    } else if (cda === "internal-coop") {
        setJsonFileBaseUrl = `https://wm-mvscoop.mvk.ds.usace.army.mil/`;
    } else if (cda === "public") {
        // setJsonFileBaseUrl = `https://www.mvs-wc.usace.army.mil/`;
        setBaseUrl = `https://cwms.sec.usace.army.mil/cwms-data/`;
    }
    console.log("setJsonFileBaseUrl: ", setJsonFileBaseUrl);

    // Define the URL to fetch location groups based on category
    const categoryApiUrl = setBaseUrl + `location/group?office=${office}&group-office-id=${office}&category-office-id=${office}&category-id=${setLocationCategory}`;
    console.log("categoryApiUrl: ", categoryApiUrl);

    // Initialize maps to store metadata and time-series ID (TSID) data for various parameters
    const metadataMap = new Map();
    const floodMap = new Map();
    const lwrpMap = new Map();
    const ownerMap = new Map();
    const tsidStageMap = new Map();
    const riverMileMap = new Map();
    const tsidTwMap = new Map();
    const tsidHingePointMap = new Map();
    const tsidTainterMap = new Map();
    const tsidRollerMap = new Map();

    // Initialize arrays for storing promises
    const metadataPromises = [];
    const floodPromises = [];
    const lwrpPromises = [];
    const ownerPromises = [];
    const stageTsidPromises = [];
    const riverMilePromises = [];
    const twTsidPromises = [];
    const hingePointTsidPromises = [];
    const tainterTsidPromises = [];
    const rollerTsidPromises = [];

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
            console.log("basins: ", basins);

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
                                        // Fetch river-mile
                                        (() => {
                                            // riverMilePromises.push(
                                            //     fetch('json/gage_control_official.json')
                                            //         .then(response => {
                                            //             if (!response.ok) {
                                            //                 throw new Error(`Network response was not ok: ${response.statusText}`);
                                            //             }
                                            //             return response.json();
                                            //         })
                                            //         .then(riverMilesJson => {
                                            //             // Loop through each basin in the JSON
                                            //             for (const basin in riverMilesJson) {
                                            //                 const locations = riverMilesJson[basin];

                                            //                 for (const loc in locations) {
                                            //                     const ownerData = locations[loc];
                                            //                     // console.log("ownerData: ", ownerData);

                                            //                     // Retrieve river mile and other data
                                            //                     const riverMile = ownerData.river_mile_hard_coded;

                                            //                     // Create an output object using the location name as ID
                                            //                     const outputData = {
                                            //                         locationId: loc, // Using location name as ID
                                            //                         basin: basin,
                                            //                         riverMile: riverMile
                                            //                     };

                                            //                     // console.log("Output Data:", outputData);
                                            //                     riverMileMap.set(loc, ownerData); // Store the data in the map
                                            //                 }
                                            //             }
                                            //         })
                                            //         .catch(error => {
                                            //             console.error('Problem with the fetch operation:', error);
                                            //         })
                                            // )
                                        })();

                                        // Fetch metadata
                                        (() => {
                                            // const locApiUrl = setBaseUrl + `locations/${loc['location-id']}?office=${office}`;
                                            // // console.log("locApiUrl: ", locApiUrl);
                                            // metadataPromises.push(
                                            //     fetch(locApiUrl)
                                            //         .then(response => {
                                            //             if (response.status === 404) {
                                            //                 console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                            //                 return null; // Skip if not found
                                            //             }
                                            //             if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                            //             return response.json();
                                            //         })
                                            //         .then(locData => {
                                            //             if (locData) {
                                            //                 metadataMap.set(loc['location-id'], locData);
                                            //             }
                                            //         })
                                            //         .catch(error => {
                                            //             console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                            //         })
                                            // );
                                        })();

                                        // Fetch flood
                                        (() => {
                                            // // Fetch flood location level for each location
                                            // const levelIdFlood = loc['location-id'] + ".Stage.Inst.0.Flood";
                                            // // console.log("levelIdFlood: ", levelIdFlood);

                                            // const levelIdEffectiveDate = "2024-01-01T08:00:00";
                                            // // console.log("levelIdEffectiveDate: ", levelIdEffectiveDate);

                                            // const floodApiUrl = setBaseUrl + `levels/${levelIdFlood}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                                            // // console.log("floodApiUrl: ", floodApiUrl);
                                            // floodPromises.push(
                                            //     fetch(floodApiUrl)
                                            //         .then(response => {
                                            //             if (response.status === 404) {
                                            //                 console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                            //                 return null; // Skip if not found
                                            //             }
                                            //             if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                            //             return response.json();
                                            //         })
                                            //         .then(floodData => {
                                            //             if (floodData) {
                                            //                 floodMap.set(loc['location-id'], floodData);
                                            //             }
                                            //         })
                                            //         .catch(error => {
                                            //             console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                            //         })
                                            // );
                                        })();

                                        // Fetch lwrp
                                        (() => {
                                            // // Fetch lwrp location level for each location
                                            // const levelIdLwrp = loc['location-id'] + ".Stage.Inst.0.LWRP";
                                            // // console.log("levelIdFlood: ", levelIdFlood);

                                            // const levelIdEffectiveDate = "2024-01-01T08:00:00";
                                            // // console.log("levelIdEffectiveDate: ", levelIdEffectiveDate);

                                            // const lwrpApiUrl = setBaseUrl + `levels/${levelIdLwrp}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                                            // // console.log("lwrpApiUrl: ", lwrpApiUrl);
                                            // lwrpPromises.push(
                                            //     fetch(lwrpApiUrl)
                                            //         .then(response => {
                                            //             if (response.status === 404) {
                                            //                 console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                            //                 return null; // Skip if not found
                                            //             }
                                            //             if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                            //             return response.json();
                                            //         })
                                            //         .then(lwrpData => {
                                            //             if (lwrpData) {
                                            //                 lwrpMap.set(loc['location-id'], lwrpData);
                                            //             }
                                            //         })
                                            //         .catch(error => {
                                            //             console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                            //         })
                                            // );
                                        })();

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
                                            const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup2}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidApiUrl:', tsidApiUrl);
                                            twTsidPromises.push(
                                                fetch(tsidApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            tsidTwMap.set(loc['location-id'], data);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch tsid 3
                                        (() => {
                                            const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup3}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidApiUrl:', tsidApiUrl);
                                            hingePointTsidPromises.push(
                                                fetch(tsidApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            tsidHingePointMap.set(loc['location-id'], data);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch tsid 4
                                        (() => {
                                            const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup4}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidApiUrl:', tsidApiUrl);
                                            tainterTsidPromises.push(
                                                fetch(tsidApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            tsidTainterMap.set(loc['location-id'], data);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch tsid 5
                                        (() => {
                                            const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup5}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidApiUrl:', tsidApiUrl);
                                            rollerTsidPromises.push(
                                                fetch(tsidApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            tsidRollerMap.set(loc['location-id'], data);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
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
                .then(() => Promise.all(metadataPromises))
                .then(() => Promise.all(floodPromises))
                .then(() => Promise.all(lwrpPromises))
                .then(() => Promise.all(ownerPromises))
                .then(() => Promise.all(stageTsidPromises))
                .then(() => Promise.all(riverMilePromises))
                .then(() => Promise.all(twTsidPromises))
                .then(() => Promise.all(hingePointTsidPromises))
                .then(() => Promise.all(tainterTsidPromises))
                .then(() => Promise.all(rollerTsidPromises))
                .then(() => {
                    combinedData.forEach(basinData => {
                        if (basinData['assigned-locations']) {
                            basinData['assigned-locations'].forEach(loc => {

                                const reorderByAttribute = (data) => {
                                    data['assigned-time-series'].sort((a, b) => a.attribute - b.attribute);
                                };

                                // Append metadata and tsid
                                (() => {
                                    // // Append metadata
                                    // const metadataMapData = metadataMap.get(loc['location-id']);
                                    // if (metadataMapData) {
                                    //     loc['metadata'] = metadataMapData;
                                    // }

                                    // // Append flood
                                    // const floodMapData = floodMap.get(loc['location-id']);
                                    // loc['flood'] = floodMapData !== undefined ? floodMapData : null;


                                    // // Append lwrp
                                    // const lwrpMapData = lwrpMap.get(loc['location-id']);
                                    // loc['lwrp'] = lwrpMapData !== undefined ? lwrpMapData : null;

                                    // // Append river-mile
                                    // const riverMileMapData = riverMileMap.get(loc['location-id']);
                                    // if (riverMileMapData) {
                                    //     loc['river-mile'] = riverMileMapData;
                                    // }

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
                                    const tsidTwMapData = tsidTwMap.get(loc['location-id']);
                                    if (tsidTwMapData) {
                                        reorderByAttribute(tsidTwMapData);
                                        loc['tsid-tw'] = tsidTwMapData;
                                    } else {
                                        loc['tsid-tw'] = null;
                                    }

                                    // Append tsid 3
                                    const tsidHingePointMapData = tsidHingePointMap.get(loc['location-id']);
                                    if (tsidHingePointMapData) {
                                        reorderByAttribute(tsidHingePointMapData);
                                        loc['tsid-hinge-point'] = tsidHingePointMapData;
                                    } else {
                                        loc['tsid-hinge-point'] = null;
                                    }

                                    // Append tsid 4
                                    const tsidTainterMapData = tsidTainterMap.get(loc['location-id']);
                                    if (tsidTainterMapData) {
                                        reorderByAttribute(tsidTainterMapData);
                                        loc['tsid-tainter'] = tsidTainterMapData;
                                    } else {
                                        loc['tsid-tainter'] = null;
                                    }

                                    // Append tsid 5
                                    const tsidRollerMapData = tsidRollerMap.get(loc['location-id']);
                                    if (tsidRollerMapData) {
                                        reorderByAttribute(tsidRollerMapData);
                                        loc['tsid-roller'] = tsidRollerMapData;
                                    } else {
                                        loc['tsid-roller'] = null;
                                    }

                                    // Initialize empty arrays to hold API and last-value data for various parameters
                                    loc['stage-api-data'] = [];
                                    loc['stage-cum-value'] = [];
                                    loc['stage-hourly-value'] = [];
                                    loc['stage-inc-value'] = [];
                                    loc['stage-last-value'] = [];
                                    loc['stage-max-value'] = [];
                                    loc['stage-min-value'] = [];

                                    loc['tw-api-data'] = [];
                                    loc['tw-cum-value'] = [];
                                    loc['tw-hourly-value'] = [];
                                    loc['tw-inc-value'] = [];
                                    loc['tw-last-value'] = [];
                                    loc['tw-max-value'] = [];
                                    loc['tw-min-value'] = [];

                                    loc['hinge-point-api-data'] = [];
                                    loc['hinge-point-cum-value'] = [];
                                    loc['hinge-point-hourly-value'] = [];
                                    loc['hinge-point-inc-value'] = [];
                                    loc['hinge-point-last-value'] = [];
                                    loc['hinge-point-max-value'] = [];
                                    loc['hinge-point-min-value'] = [];

                                    loc['tainter-api-data'] = [];
                                    loc['tainter-cum-value'] = [];
                                    loc['tainter-hourly-value'] = [];
                                    loc['tainter-inc-value'] = [];
                                    loc['tainter-last-value'] = [];
                                    loc['tainter-max-value'] = [];
                                    loc['tainter-min-value'] = [];

                                    loc['roller-api-data'] = [];
                                    loc['roller-cum-value'] = [];
                                    loc['roller-hourly-value'] = [];
                                    loc['roller-inc-value'] = [];
                                    loc['roller-last-value'] = [];
                                    loc['roller-max-value'] = [];
                                    loc['roller-min-value'] = [];
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
                            const twTimeSeries = locData['tsid-tw']?.['assigned-time-series'] || [];
                            const hingePointTimeSeries = locData['tsid-hinge-point']?.['assigned-time-series'] || [];
                            const tainterTimeSeries = locData['tsid-tainter']?.['assigned-time-series'] || [];
                            const rollerTimeSeries = locData['tsid-roller']?.['assigned-time-series'] || [];

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

                                            const lastValue = getLastNonNullValue(data, tsid);
                                            const maxValue = getMaxValue(data, tsid);
                                            const minValue = getMinValue(data, tsid);
                                            const cumValue = getCumValue(data, tsid);
                                            const incValue = getIncValue(data, tsid);
                                            const hourlyValue = getHourlyDataOnTopOfHour(data, tsid);

                                            updateLocData(locData, type, data, lastValue, maxValue, minValue, cumValue, incValue, hourlyValue);
                                        })

                                        .catch(error => {
                                            console.error(`Error fetching additional data for location ${locData['location-id']} with TSID ${tsid}:`, error);
                                        });
                                });
                            };

                            // Create promises for temperature, depth, and DO time series
                            const stagePromises = timeSeriesDataFetchPromises(stageTimeSeries, 'stage');
                            const twPromises = timeSeriesDataFetchPromises(twTimeSeries, 'tw');
                            const hingePointPromises = timeSeriesDataFetchPromises(hingePointTimeSeries, 'hinge-point');
                            const tainterPromises = timeSeriesDataFetchPromises(tainterTimeSeries, 'tainter');
                            const rollerPromises = timeSeriesDataFetchPromises(rollerTimeSeries, 'roller');

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
                                    const stageTids = stageTimeSeries.map(series => series['timeseries-id']);
                                    const twTids = twTimeSeries.map(series => series['timeseries-id']);
                                    const hingePointTids = twTimeSeries.map(series => series['timeseries-id']);
                                    const tainterTids = tainterTimeSeries.map(series => series['timeseries-id']);
                                    const rollerTids = rollerTimeSeries.map(series => series['timeseries-id']);
                                    const allTids = [...stageTids, ...twTids, ...hingePointTids, ...tainterTids, ...rollerTids]; // Combine both arrays

                                    allTids.forEach((tsid, index) => {
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
                            timeSeriesDataPromises.push(Promise.all([...stagePromises, ...twPromises, ...hingePointPromises, ...tainterPromises, ...rollerPromises, timeSeriesDataExtentsApiCall()]));
                        }
                    }

                    // Wait for all additional data fetches to complete
                    return Promise.all(timeSeriesDataPromises);
                })
                .then(() => {
                    console.log('All combinedData data fetched successfully:', combinedData);

                    const table = createTableLdGateSummary(combinedData, type, mobile);

                    // Append the table to the specified container
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
            document.getElementById(`table_container_${setReportDiv}`).innerHTML =
                `Cloud database is down. Submit outage at <a href='https://github.com/USACE/cwms-data-api/issues' target='_blank'>https://github.com/USACE/cwms-data-api/issues</a>.`;

            // Show the "Report Issue" button
            document.getElementById('reportIssueBtn').style.display = "block";

            // Ensure sendEmail is globally accessible
            window.sendEmail = function () {
                const subject = encodeURIComponent("Cloud Database Down");
                const body = encodeURIComponent("Hello,\n\nIt appears that the cloud database is down. Please investigate the issue.");
                const email = "DLL-CEMVS-WM-SysAdmins@usace.army.mil"; // Replace with actual support email

                window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
            };
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

    function subtractDaysFromDate(date, daysToSubtract) {
        return new Date(date.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
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

    function getLastNonNullValue(data, tsid) {
        // Iterate over the values array in reverse
        for (let i = data.values.length - 1; i >= 0; i--) {
            // Check if the value at index i is not null
            if (data.values[i][1] !== null) {
                // Return the non-null value as separate variables
                return {
                    tsid: tsid,
                    timestamp: data.values[i][0],
                    value: data.values[i][1],
                    qualityCode: data.values[i][2]
                };
            }
        }
        // If no non-null value is found, return null
        return null;
    }

    function getMaxValue(data, tsid) {
        let maxValue = -Infinity; // Start with the smallest possible value
        let maxEntry = null; // Store the corresponding max entry (timestamp, value, quality code)

        // Loop through the values array
        for (let i = 0; i < data.values.length; i++) {
            // Check if the value at index i is not null
            if (data.values[i][1] !== null) {
                // Update maxValue and maxEntry if the current value is greater
                if (data.values[i][1] > maxValue) {
                    maxValue = data.values[i][1];
                    maxEntry = {
                        tsid: tsid,
                        timestamp: data.values[i][0],
                        value: data.values[i][1],
                        qualityCode: data.values[i][2]
                    };
                }
            }
        }

        // Return the max entry (or null if no valid values were found)
        return maxEntry;
    }

    function getMinValue(data, tsid) {
        let minValue = Infinity; // Start with the largest possible value
        let minEntry = null; // Store the corresponding min entry (timestamp, value, quality code)

        // Loop through the values array
        for (let i = 0; i < data.values.length; i++) {
            // Check if the value at index i is not null
            if (data.values[i][1] !== null) {
                // Update minValue and minEntry if the current value is smaller
                if (data.values[i][1] < minValue) {
                    minValue = data.values[i][1];
                    minEntry = {
                        tsid: tsid,
                        timestamp: data.values[i][0],
                        value: data.values[i][1],
                        qualityCode: data.values[i][2]
                    };
                }
            }
        }

        // Return the min entry (or null if no valid values were found)
        return minEntry;
    }

    function getCumValue(data, tsid) {
        let value0 = null;  // Recent (0 hours)
        let value6 = null;  // 6 hours earlier
        let value12 = null; // 12 hours earlier
        let value18 = null; // 18 hours earlier
        let value24 = null; // 24 hours earlier
        let value30 = null; // 30 hours earlier
        let value36 = null; // 36 hours earlier
        let value42 = null; // 42 hours earlier
        let value48 = null; // 48 hours earlier
        let value54 = null; // 54 hours earlier
        let value60 = null; // 60 hours earlier
        let value66 = null; // 66 hours earlier
        let value72 = null; // 72 hours earlier

        // Iterate over the values array in reverse
        for (let i = data.values.length - 1; i >= 0; i--) {
            const [timestamp, value, qualityCode] = data.values[i];

            // Check if the value at index i is not null
            if (value !== null) {
                // Convert timestamp to Date object
                const currentTimestamp = new Date(timestamp);
                // console.log("currentTimestamp: ", currentTimestamp);

                // If value0 hasn't been set, set it to the latest non-null value
                if (!value0) {
                    value0 = { tsid, timestamp, value, qualityCode };
                } else {
                    // Calculate target timestamps for each interval
                    const sixHoursEarlier = new Date(value0.timestamp);
                    sixHoursEarlier.setHours(sixHoursEarlier.getHours() - 6);

                    const twelveHoursEarlier = new Date(value0.timestamp);
                    twelveHoursEarlier.setHours(twelveHoursEarlier.getHours() - 12);

                    const eighteenHoursEarlier = new Date(value0.timestamp);
                    eighteenHoursEarlier.setHours(eighteenHoursEarlier.getHours() - 18);

                    const twentyFourHoursEarlier = new Date(value0.timestamp);
                    twentyFourHoursEarlier.setHours(twentyFourHoursEarlier.getHours() - 24);

                    const thirtyHoursEarlier = new Date(value0.timestamp);
                    thirtyHoursEarlier.setHours(thirtyHoursEarlier.getHours() - 30);

                    const thirtySixHoursEarlier = new Date(value0.timestamp);
                    thirtySixHoursEarlier.setHours(thirtySixHoursEarlier.getHours() - 36);

                    const fortyTwoHoursEarlier = new Date(value0.timestamp);
                    fortyTwoHoursEarlier.setHours(fortyTwoHoursEarlier.getHours() - 42);

                    const fortyEightHoursEarlier = new Date(value0.timestamp);
                    fortyEightHoursEarlier.setHours(fortyEightHoursEarlier.getHours() - 48);

                    const fiftyFourHoursEarlier = new Date(value0.timestamp);
                    fiftyFourHoursEarlier.setHours(fiftyFourHoursEarlier.getHours() - 54);

                    const sixtyHoursEarlier = new Date(value0.timestamp);
                    sixtyHoursEarlier.setHours(sixtyHoursEarlier.getHours() - 60);

                    const sixtySixHoursEarlier = new Date(value0.timestamp);
                    sixtySixHoursEarlier.setHours(sixtySixHoursEarlier.getHours() - 66);

                    const seventyTwoHoursEarlier = new Date(value0.timestamp);
                    seventyTwoHoursEarlier.setHours(seventyTwoHoursEarlier.getHours() - 72);

                    // Assign values if the timestamps match
                    if (!value6 && currentTimestamp.getTime() === sixHoursEarlier.getTime()) {
                        value6 = { tsid, timestamp, value, qualityCode };
                    } else if (!value12 && currentTimestamp.getTime() === twelveHoursEarlier.getTime()) {
                        value12 = { tsid, timestamp, value, qualityCode };
                    } else if (!value18 && currentTimestamp.getTime() === eighteenHoursEarlier.getTime()) {
                        value18 = { tsid, timestamp, value, qualityCode };
                    } else if (!value24 && currentTimestamp.getTime() === twentyFourHoursEarlier.getTime()) {
                        value24 = { tsid, timestamp, value, qualityCode };
                    } else if (!value30 && currentTimestamp.getTime() === thirtyHoursEarlier.getTime()) {
                        value30 = { tsid, timestamp, value, qualityCode };
                    } else if (!value36 && currentTimestamp.getTime() === thirtySixHoursEarlier.getTime()) {
                        value36 = { tsid, timestamp, value, qualityCode };
                    } else if (!value42 && currentTimestamp.getTime() === fortyTwoHoursEarlier.getTime()) {
                        value42 = { tsid, timestamp, value, qualityCode };
                    } else if (!value48 && currentTimestamp.getTime() === fortyEightHoursEarlier.getTime()) {
                        value48 = { tsid, timestamp, value, qualityCode };
                    } else if (!value54 && currentTimestamp.getTime() === fiftyFourHoursEarlier.getTime()) {
                        value54 = { tsid, timestamp, value, qualityCode };
                    } else if (!value60 && currentTimestamp.getTime() === sixtyHoursEarlier.getTime()) {
                        value60 = { tsid, timestamp, value, qualityCode };
                    } else if (!value66 && currentTimestamp.getTime() === sixtySixHoursEarlier.getTime()) {
                        value66 = { tsid, timestamp, value, qualityCode };
                    } else if (!value72 && currentTimestamp.getTime() === seventyTwoHoursEarlier.getTime()) {
                        value72 = { tsid, timestamp, value, qualityCode };
                    }

                    // Break loop if all values are found
                    if (
                        value6 &&
                        value12 &&
                        value18 &&
                        value24 &&
                        value30 &&
                        value36 &&
                        value42 &&
                        value48 &&
                        value54 &&
                        value60 &&
                        value66 &&
                        value72
                    ) {
                        break;
                    }
                }
            }
        }

        // Calculate incremental values (valueX - valuePrevious)
        // const incrementalValues = {
        //     incremental6: value6 ? value0.value - value6.value : null,
        //     incremental12: value12 ? value6.value - value12.value : null,
        //     incremental18: value18 ? value12.value - value18.value : null,
        //     incremental24: value24 ? value18.value - value24.value : null,
        //     incremental30: value30 ? value24.value - value30.value : null,
        //     incremental36: value36 ? value30.value - value36.value : null,
        //     incremental42: value42 ? value36.value - value42.value : null,
        //     incremental48: value48 ? value42.value - value48.value : null,
        //     incremental54: value54 ? value48.value - value54.value : null,
        //     incremental60: value60 ? value54.value - value60.value : null,
        //     incremental66: value66 ? value60.value - value66.value : null,
        //     incremental72: value72 ? value66.value - value72.value : null,
        // };

        // Calculate cumulative values (value0 - valueX)
        const cumulativeValues = {
            cumulative6: value0 && value6 ? value0.value - value6.value : null,
            cumulative12: value0 && value12 ? value0.value - value12.value : null,
            cumulative24: value0 && value24 ? value0.value - value24.value : null,
            cumulative48: value0 && value48 ? value0.value - value48.value : null,
            cumulative72: value0 && value72 ? value0.value - value72.value : null,
        };

        return {
            value0,
            value6,
            value12,
            value18,
            value24,
            value30,
            value36,
            value42,
            value48,
            value54,
            value60,
            value66,
            value72,
            // ...incrementalValues, // Spread operator to include incremental values in the return object
            ...cumulativeValues // Spread operator to include cumulative values in the return object
        };
    }

    function getIncValue(data, tsid) {
        let value0 = null;  // Recent (0 hours)
        let value6 = null;  // 6 hours earlier
        let value12 = null; // 12 hours earlier
        let value18 = null; // 18 hours earlier
        let value24 = null; // 24 hours earlier
        let value30 = null; // 30 hours earlier
        let value36 = null; // 36 hours earlier
        let value42 = null; // 42 hours earlier
        let value48 = null; // 48 hours earlier
        let value54 = null; // 54 hours earlier
        let value60 = null; // 60 hours earlier
        let value66 = null; // 66 hours earlier
        let value72 = null; // 72 hours earlier

        // Iterate over the values array in reverse
        for (let i = data.values.length - 1; i >= 0; i--) {
            const [timestamp, value, qualityCode] = data.values[i];

            // Check if the value at index i is not null
            if (value !== null) {
                // Convert timestamp to Date object
                const currentTimestamp = new Date(timestamp);

                // If value0 hasn't been set, set it to the latest non-null value
                if (!value0) {
                    value0 = { tsid, timestamp, value, qualityCode };
                } else {
                    // Calculate target timestamps for each interval
                    const intervals = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72];
                    const valuesMap = [value6, value12, value18, value24, value30, value36, value42, value48, value54, value60, value66, value72];

                    intervals.forEach((interval, idx) => {
                        const targetTime = new Date(value0.timestamp);
                        targetTime.setHours(targetTime.getHours() - interval);
                        if (!valuesMap[idx] && currentTimestamp.getTime() === targetTime.getTime()) {
                            valuesMap[idx] = { tsid, timestamp, value, qualityCode };
                        }
                    });

                    // Break loop if all values are found
                    if (valuesMap.every(val => val !== null)) {
                        break;
                    }
                }
            }
        }

        // Calculate incremental values (valueX - valuePrevious) if both values are not null
        const incrementalValues = {
            incremental6: value6 && value0 ? value0.value - value6.value : null,
            incremental12: value12 && value6 ? value6.value - value12.value : null,
            incremental18: value18 && value12 ? value12.value - value18.value : null,
            incremental24: value24 && value18 ? value18.value - value24.value : null,
            incremental30: value30 && value24 ? value24.value - value30.value : null,
            incremental36: value36 && value30 ? value30.value - value36.value : null,
            incremental42: value42 && value36 ? value36.value - value42.value : null,
            incremental48: value48 && value42 ? value42.value - value48.value : null,
            incremental54: value54 && value48 ? value48.value - value54.value : null,
            incremental60: value60 && value54 ? value54.value - value60.value : null,
            incremental66: value66 && value60 ? value60.value - value66.value : null,
            incremental72: value72 && value66 ? value66.value - value72.value : null,
        };

        return {
            value0,
            value6,
            value12,
            value18,
            value24,
            value30,
            value36,
            value42,
            value48,
            value54,
            value60,
            value66,
            value72,
            ...incrementalValues
        };
    }

    function getHourlyDataOnTopOfHour(data, tsid) {
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

    function createTableLdGateSummary(combinedData, type, mobile) {
        // Create a new table element and set its ID
        const table = document.createElement('table');
        table.setAttribute('id', 'gage_data');

        // Loop through each basin in the combined data
        combinedData.forEach((basin) => {
            // Loop through each assigned location in the basin
            basin['assigned-locations'].forEach((location) => {
                // console.log("location-id: ", location['location-id']);

                // Create a row for the location ID spanning 6 columns
                const locationRow = document.createElement('tr');
                const locationCell = document.createElement('th');
                locationCell.colSpan = 6; // Set colspan to 6 for location ID
                locationCell.textContent = (location['location-id']).split('-')[0];
                // locationCell.style.height = '50px'; // Set the height of the locationCell
                locationRow.appendChild(locationCell);
                table.appendChild(locationRow); // Append the location row to the table

                // Create a header row for the data columns
                const headerRow = document.createElement('tr');
                const columns = ["Date Time", "Pool", "Tail Water", "Hinge Point", "Tainter", "Roller"];
                columns.forEach((columnName) => {
                    const th = document.createElement('th');
                    th.textContent = columnName; // Set the header text
                    // th.style.height = '40px'; // Set the height of the header
                    // th.style.backgroundColor = 'darkblue'; // Set background color
                    // th.style.color = 'white'; // Set text color
                    headerRow.appendChild(th); // Append header cells to the header row
                });
                table.appendChild(headerRow); // Append the header row to the table

                // Sort stage-hourly-value array by timestamp in descending order
                // const sortedEntries = location['stage-hourly-value'][0].slice().sort((a, b) => {
                //     const dateA = new Date(a.timestamp);
                //     const dateB = new Date(b.timestamp);
                //     return dateB - dateA; // Descending order
                // });

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

                    if (mobile === true && dateTime !== "N/A") {
                        // Remove the year from the timestamp for mobile
                        dateTimeDisplay = dateTime.replace(/-\d{4}/, ''); // Removes '-2025'
                    } else {
                        dateTimeDisplay = dateTime;
                    }

                    // Check if the current timestamp matches any poolValue timestamp
                    const poolValueEntry = location['stage-hourly-value'][0].find(poolValue => poolValue.timestamp === dateTime);
                    const poolValue = poolValueEntry && typeof poolValueEntry.value === 'number' ? poolValueEntry.value.toFixed(2) : "--";

                    // Match timestamps and grab values for tailWaterValue, hingePointValue, tainterValue, and rollerValue
                    const tailWaterEntry = location['tw-hourly-value']?.[0]?.find(tailWater => tailWater.timestamp === dateTime);
                    const tailWaterValue = tailWaterEntry && typeof tailWaterEntry.value === 'number' ? tailWaterEntry.value.toFixed(2) : "--";

                    const hingePointEntry = location['hinge-point-hourly-value']?.[0]?.find(hingePoint => hingePoint.timestamp === dateTime);
                    const hingePointValue = hingePointEntry && typeof hingePointEntry.value === 'number' ? hingePointEntry.value.toFixed(2) : "--";

                    const tainterEntry = location['tainter-hourly-value']?.[0]?.find(tainter => tainter.timestamp === dateTime);
                    const tainterValue = tainterEntry && typeof tainterEntry.value === 'number' ? tainterEntry.value.toFixed(2) : "--";

                    const rollerEntry = location['roller-hourly-value']?.[0]?.find(roller => roller.timestamp === dateTime);
                    const rollerValue = rollerEntry && typeof rollerEntry.value === 'number' ? rollerEntry.value.toFixed(2) : "--";

                    // Create and append cells to the row for each value
                    [dateTimeDisplay, poolValue, tailWaterValue, hingePointValue, tainterValue, rollerValue].forEach((value) => {
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

    function updateLocData(locData, type, data, lastValue, maxValue, minValue, cumValue, incValue, hourlyValue) {
        const keys = {
            apiDataKey: `${type}-api-data`,
            lastValueKey: `${type}-last-value`,
            maxValueKey: `${type}-max-value`,
            minValueKey: `${type}-min-value`,
            cumValueKey: `${type}-cum-value`,
            incValueKey: `${type}-inc-value`,
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
                case 'lastValueKey':
                    locData[value].push(lastValue);
                    break;
                case 'maxValueKey':
                    locData[value].push(maxValue);
                    break;
                case 'minValueKey':
                    locData[value].push(minValue);
                    break;
                case 'cumValueKey':
                    locData[value].push(cumValue);
                    break;
                case 'incValueKey':
                    locData[value].push(incValue);
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
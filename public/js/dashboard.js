import { API } from '/js/utils/index.js';

// Dashboard UI and Charting Logic
let worldMap;

document.addEventListener('DOMContentLoaded', async function() {
    let source = 'userLogs'; // Default source
    let selectedCollection = null;
    const summaryCards = document.querySelectorAll('.summary-card');

    summaryCards.forEach(card => {
        card.addEventListener('click', function() {
            summaryCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedCollection = this.getAttribute('data-collection');
            const worldMapTitle = document.getElementById('worldMapTitle');
            if (worldMapTitle) {
                worldMapTitle.innerText = `- ${selectedCollection.charAt(0).toUpperCase() + selectedCollection.slice(1)}`;
            }
            listAllLogs(selectedCollection); // Refresh the map and table with the selected source
        });
    });

    const sourceSelect = document.getElementById('sourceSelect');
    sourceSelect.addEventListener('change', function() {
        source = this.value;
        listAllLogs(source);
    });

    listAllLogs("userLogs");
    await getUserInfo();

    // Draggable scroll for summary cards
    const scrollContainer = document.getElementById('card-scroll-container');
    let isDown = false;
    let startY;
    let scrollTop;

    if (scrollContainer) {
        scrollContainer.addEventListener('mousedown', (e) => {
            isDown = true;
            scrollContainer.classList.add('grabbing');
            startY = e.pageY - scrollContainer.offsetTop;
            scrollTop = scrollContainer.scrollTop;
        });

        scrollContainer.addEventListener('mouseleave', () => {
            isDown = false;
            scrollContainer.classList.remove('grabbing');
        });

        scrollContainer.addEventListener('mouseup', () => {
            isDown = false;
            scrollContainer.classList.remove('grabbing');
        });

        scrollContainer.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const y = e.pageY - scrollContainer.offsetTop;
            const walk = (y - startY) * 2;
            scrollContainer.scrollTop = scrollTop - walk;
        });
    }
});

async function getUserInfo() {
    const info = await API.ipLookUp();
    document.getElementById('ip_id').innerHTML = "<pre>" + JSON.stringify(info.TimeZone, null, '\t') + "</pre>";
}

function generateCustomLegend() {
    const legendContainer = document.getElementById('worldMapLegend');
    if (!legendContainer) return;

    const legendData = [
        { color: 'rgba(0, 200, 100, 0.5)', label: '< 40 Hits' },
        { color: 'rgba(0, 100, 200, 0.7)', label: '>= 40 Hits' },
        { color: 'rgba(200, 200, 200, 0.25)', label: 'No Data' }
    ];

    let legendHTML = '<h5>Legend</h5><ul class="list-unstyled">';
    legendData.forEach(item => {
        legendHTML += `
            <li>
                <span class="legend-color-box" style="background-color:${item.color};"></span>
                ${item.label}
            </li>`;
    });
    legendHTML += '</ul>';

    legendContainer.innerHTML = legendHTML;
}


function setWorlGraph(data) {
    const countryNameCorrections = {
        "United States": "United States of America",
        "Russia": "Russian Federation",
        "South Korea": "Korea, Republic of",
    };

    const countryCounts = data.reduce((acc, entry) => {
        if (entry.CountryName) {
            const correctedCountryName = countryNameCorrections[entry.CountryName] || entry.CountryName;
            acc[correctedCountryName] = (acc[correctedCountryName] || 0) + 1;
        }
        return acc;
    }, {});

    updateMapDataFeed(countryCounts);

    fetch('https://unpkg.com/world-atlas/countries-50m.json')
        .then(response => response.json())
        .then(world => {
            const countries = ChartGeo.topojson.feature(world, world.objects.countries).features;
            const validCountryNames = new Set(countries.map(country => country.properties.name));
            Object.keys(countryCounts).forEach(countryName => {
                if (!validCountryNames.has(countryName)) {
                    // This console.warn is being removed as per code review feedback.
                    // console.warn(`Country name not found in ChartGeo countries list: ${countryName}`);
                }
            });
            const chartData = {
                labels: countries.map(d => d.properties.name),
                datasets: [{
                    label: 'Countries',
                    data: countries.map(country => ({
                        feature: country,
                        value: countryCounts[country.properties.name] || 0
                    })),
                    backgroundColor: (context) => {
                        const dataItem = context.dataset.data[context.dataIndex];
                        if (!dataItem || !dataItem.value) {
                            return 'rgba(200, 200, 200, 0.25)'; // Default grey for missing values
                        }
                        const value = dataItem.value;
                        if (value < 40) return `rgba(0, 200, 100, ${(value * 5) / 200 + 0.15})`;
                        return `rgba(0, 100, 200, ${(value * 3) / 100 + 0.1})`;
                    },
                }]
            };

            const config = {
                type: 'choropleth',
                data: chartData,
                options: {
                    showOutline: false,
                    showGraticule: false,
                     scales: {
                        projection: {
                            axis: 'x',
                            projection: 'equalEarth',
                        },
                        color: {
                            axis: 'x',
                            quantize: 5, // Example: 5 color steps
                            interpolate: 'YlGnBu', // Example: Yellow-Green-Blue color scheme
                            //display: false
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // Keep the default legend off
                        }
                    }
                }
            };

            if (worldMap) {
                worldMap.destroy();
            }
            worldMap = new Chart(document.getElementById('worldMap'), config);
            generateCustomLegend(); // Call the function to generate our custom legend
        });
}

function updateMapDataFeed(countryCounts) {
    const dataFeedContainer = document.getElementById('mapDataFeed');
    if (!dataFeedContainer) return;

    let tableHTML = `
        <table class="table table-sm table-striped">
            <thead>
                <tr>
                    <th>Country</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const [country, value] of Object.entries(countryCounts)) {
        tableHTML += `
            <tr>
                <td>${country}</td>
                <td>${value}</td>
            </tr>
        `;
    }

    tableHTML += `
            </tbody>
        </table>
    `;

    dataFeedContainer.innerHTML = tableHTML;
}

const loadingElement = document.querySelector('.loading');

function listAllLogs(source) {
    loadingElement.style.display = '';
    const url = `api/v1/v2/logs?source=${source}`;
    fetch(url)
        .then(response => response.json())
        .then(result => {
            setWorlGraph(result.logs || []);

            if (!result.logs || result.logs.length === 0) {
                loadDataTable({ data: [], columns: [] });
                loadingElement.style.display = 'none';
                return;
            }

            const allKeys = new Set();
            result.logs.forEach(log => {
                if (log && typeof log === 'object') {
                    Object.keys(log).forEach(key => allKeys.add(key));
                }
            });

            const normalizedLogs = result.logs.map(log => {
                const normalizedLog = {};
                allKeys.forEach(key => {
                    normalizedLog[key] = log && log.hasOwnProperty(key) ? log[key] : "";
                });
                return normalizedLog;
            });

            const columns = Array.from(allKeys).map((key) => ({
                title: key.charAt(0).toUpperCase() + key.slice(1),
                data: key,
                defaultContent: "",
                render: (key === 'date' || key === 'created') ? function(data) {
                    if (!data) return "";
                    const dateObj = new Date(data);
                    return isNaN(dateObj.getTime()) ? "" : dateObj.toLocaleString();
                } : null,
            }));

            loadDataTable({ data: normalizedLogs, columns });
            loadingElement.style.display = 'none';
        })
        .catch(error => {
            console.error('Error fetching logs:', error);
            loadingElement.style.display = 'none';
        });
}

function loadDataTable(dataset) {
    const table = $('#logsTable');
    if ($.fn.DataTable.isDataTable(table)) {
        table.DataTable().clear().destroy();
    }
    table.empty();
    table.DataTable({
        data: dataset.data,
        columns: dataset.columns,
        destroy: true,
        scrollX: true
    });
}

// Sidebar toggle functionality
var mySidebar = document.getElementById("mySidebar");
var overlayBg = document.getElementById("myOverlay");

window.w3_open = function() {
    if (mySidebar.style.display === 'block') {
        mySidebar.style.display = 'none';
        overlayBg.style.display = "none";
    } else {
        mySidebar.style.display = 'block';
        overlayBg.style.display = "block";
    }
}

window.w3_close = function() {
    mySidebar.style.display = "none";
    overlayBg.style.display = "none";
}
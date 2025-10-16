console.log('database-viewer.js loaded');

const errorElement = document.querySelector('.error-message');
const loadingElement = document.querySelector('.loading');
const bootsElement = document.querySelector('.boots');
const loadMoreElement = document.querySelector('#loadMore');
const DATA_API = window.apiUrl;

let skip = 0;
let limit = 30;
let loading = false;
let finished = false;

class DBSelecter {
    constructor(collectionList, collectionSelected, html_dom, onChangeCallback = null) {
        this.selectDom = html_dom;
        this.collectionList = collectionList;
        this.selectElm = document.getElementById(html_dom);
        this.changeCallback = onChangeCallback ? onChangeCallback : null;

        if (this.collectionList.length != 0) {
            for (let col in this.collectionList) {
                this.selectElm.options[this.selectElm.options.length] = new Option(this.collectionList[col], col);
            }

            let index = this.collectionList.indexOf(collectionSelected);
            this.selectElm.options[index].selected = "true";
            this.selectedCollection = this.getSelectText();
            console.log("Setting selected: " + this.selectedCollection);
        } else {
            console.log('no Collection list');
        }
    }

    getSelectText() {
        let txt = $("#" + this.selectDom + ">option:selected").text();
        return txt;
    }

    updateSelected() {
        this.selectedCollection = this.getSelectText();
        console.log("Selecting: " + this.selectedCollection);
        if (this.changeCallback) this.changeCallback();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const collectionList = window.collectionList || [];
    const selectedCollection = collectionList.length > 0 ? collectionList[0] : '';

    let dbSelect = new DBSelecter(collectionList, selectedCollection, "collection_select", sendRequest);

    document.getElementById('send_request_btn').addEventListener('click', sendRequest);

    function sendRequest() {
        listAll(dbSelect.selectedCollection, true);
    }

    listAll(selectedCollection, true);

    errorElement.style.display = 'none';

    document.addEventListener('scroll', () => {
        const rect = loadMoreElement.getBoundingClientRect();
        if (rect.top < window.innerHeight && !loading && !finished) {
            loadMore();
        }
    });

    function loadMore() {
        skip += limit;
        listAll(dbSelect.selectedCollection, false);
    }

    async function listAll(selectedCollection, reset = true) {
        loading = true;
        if (reset) {
            console.log('reset - dropping new list');
            bootsElement.innerHTML = '';
            skip = 0;
            finished = false;
        }

        const params = {
            skip: document.getElementById('skip_id').value,
            limit: document.getElementById('limit_id').value,
            sort: document.getElementById('sort_id').value,
            collection: selectedCollection ? selectedCollection : ""
        };

        const url = `${DATA_API}/${params.collection}?skip=${params.skip}&limit=${params.limit}&sort=${params.sort}`;
        console.log(url);

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.data) {
                if (reset) {
                    bootsElement.innerHTML = ''; // Clear previous content
                }
                
                let table = bootsElement.querySelector('table');
                if (!table) {
                    table = document.createElement('table');
                    table.className = 'table table-striped table-bordered';
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    const tbody = document.createElement('tbody');
                    table.appendChild(tbody);
                    bootsElement.appendChild(table);
                }

                const thead = table.querySelector('thead');
                const tbody = table.querySelector('tbody');

                if (result.data.length > 0) {
                    // Populate header row if it's empty
                    if (thead.querySelector('tr').children.length === 0) {
                        const keys = Object.keys(result.data[0]);
                        keys.forEach(key => {
                            const th = document.createElement('th');
                            th.textContent = key;
                            thead.querySelector('tr').appendChild(th);
                        });
                    }

                    // Populate table rows
                    result.data.forEach(log => {
                        const row = document.createElement('tr');
                        Object.values(log).forEach(value => {
                            const td = document.createElement('td');
                            td.textContent = typeof value === 'object' ? JSON.stringify(value) : value;
                            row.appendChild(td);
                        });
                        tbody.appendChild(row);
                    });
                }

                loadingElement.style.display = 'none';
                console.log(result.meta.has_more ? "Droplist has more" : "Droplist is done");
                if (!result.meta.has_more) {
                    loadMoreElement.style.visibility = 'hidden';
                    finished = true;
                } else {
                    loadMoreElement.style.visibility = 'visible';
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            errorElement.textContent = 'Failed to fetch data. Please try again.';
            errorElement.style.display = 'block';
        }

        loading = false;
    }
});
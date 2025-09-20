const Tools = {
    showArrayOnDOM: (arr, domId) => {
        const list = document.getElementById(domId);
        list.innerHTML = '';
        arr.forEach(item => {
            const li = document.createElement('li');
            li.textContent = JSON.stringify(item);
            list.appendChild(li);
        });
    },
    getDOMSelectedOption: (sel) => {
        return sel.options[sel.selectedIndex];
    },
    fillForm: (formId, data) => {
        const form = document.getElementById(formId);
        for (const key in data) {
            if (form.elements[key]) {
                form.elements[key].value = data[key];
            }
        }
    }
};

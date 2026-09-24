// generic wrapper that repeats a given NfisQuickEntryForm subclass N times,
// with buttons to add/remove rows. Data is the array of each row's data, so
// it merges into a parent's getData() like any other sub-form. Usable
// directly from getSubForms(), no need for a dedicated subclass per field:
//
// getSubForms() {
//     return [{
//         form: new NfisQuickEntryRepeatingForm({
//             name: 'datierungen',
//             rowFormClass: NfisQuickEntryObjectDateRangeForm,
//             rowFormOpts: { poolIds: this.poolIds, optionsMap: this.optionsMap },
//         }),
//         position: 'above'
//     }];
// }
class NfisQuickEntryRepeatingForm extends NfisQuickEntryForm {

    constructor({ name, rowFormClass, rowFormOpts = {}, minRows = 1, addButtonText = 'Hinzufügen', onDataChanged } = {}) {
        super({ onDataChanged });
        this.__name = name;
        this.rowFormClass = rowFormClass;
        this.rowFormOpts = rowFormOpts;
        this.minRows = minRows;
        this.addButtonText = addButtonText;
        this.rows = [];
        this.__list = null;
        this.__addButton = null;
        this.__addButtonRow = null;
    }

    getName() {
        return this.__name;
    }

    getData() {
        return this.rows.map(row => row.getData());
    }

    start() {
        for (let i = 0; i < this.minRows; i++) {
            this.__addRow();
        }

        return this;
    }

    __addRow() {
        const row = new this.rowFormClass({
            ...this.rowFormOpts,
            onDataChanged: () => this.onDataChanged(this.getData())
        }).start();

        this.rows.push(row);
        this.__renderList();

        return row;
    }

    __removeRow(row) {
        if (this.rows.length <= this.minRows) {
            return;
        }

        this.rows = this.rows.filter(r => r !== row);
        this.__renderList();
        this.onDataChanged(this.getData());
    }

    __buildRowContent(row) {
        if (this.rows.length <= this.minRows) {
            return new CUI.HorizontalLayout({
                center: { content: [row.render()] },
            });
        }

        const removeButton = new CUI.Button({
            icon: 'trash',
            onClick: () => this.__removeRow(row)
        });

        return new CUI.HorizontalLayout({
            center: { content: [row.render()] },
            right: { content: [removeButton] }
        });
    }

    // rebuilds the whole "center" slot of our own, already-rendered
    // VerticalList in place, so adding/removing a row never has to touch
    // the containing app's layout at all
    __renderList() {
        if (!this.__list) {
            return;
        }

        const content = [...this.rows.map(row => this.__buildRowContent(row)), this.__addButtonRow];
        this.__list.replace(content, "center");
    }

    render() {
        if (!this.__list) {
            this.__addButton = new CUI.Button({
                text: this.addButtonText,
                onClick: () => {
                    this.__addRow();
                    this.onDataChanged(this.getData());
                }
            });

            this.__addButtonRow = new CUI.HorizontalLayout({
                class: 'nfis-quick-entry-form-repeat-button-row',
                right: {
                    content: [this.__addButton]
                }
            })

            this.__list = new CUI.VerticalList({
                maximize_horizontal: true,
                content: [
                    ...this.rows.map(row => this.__buildRowContent(row)),
                    this.__addButtonRow
                ]
            });
        }

        return this.__list;
    }
}

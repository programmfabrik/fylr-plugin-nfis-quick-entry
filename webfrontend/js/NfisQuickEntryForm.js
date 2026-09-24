class NfisQuickEntryForm {

    constructor({ onDataChanged } = {}) {
        // not built here: subclasses may need to set fields (after calling
        // super()) before getName()/getDefaultData() can be called, so this
        // is deferred until start()
        this.data = null;
        this.onDataChanged = onDataChanged || (() => { });
        this.cuiForm = null;
        this.subForms = [];
    }

    getName() {
        throw new Error("NfisQuickEntryForm subclasses must implement getName()");
    }

    getDefaultData() {
        return {};
    }

    getClass() {
        return null;
    }

    getHorizontal() {
        return false;
    }

    getFields() {
        throw new Error("NfisQuickEntryForm subclasses must implement getFields()");
    }

    // sub-forms are started and rendered alongside this form. Each entry is
    // { form: NfisQuickEntryForm instance, position: 'above' | 'below' }
    getSubForms() {
        return [];
    }

    getData() {
        const data = this.data[this.getName()];

        for (const subForm of this.subForms) {
            data[subForm.form.getName()] = subForm.form.getData();
        }

        return data;
    }

    start() {
        this.data = { [this.getName()]: this.getDefaultData() };

        this.subForms = this.getSubForms();
        for (const subForm of this.subForms) {
            const onSubFormDataChanged = subForm.form.onDataChanged;
            subForm.form.onDataChanged = (subFormData) => {
                // make sure onDataChanged propagates without affecting the onDataChanged of the subForm
                onSubFormDataChanged(subFormData);
                this.onDataChanged(this.getData());
            };
            subForm.form.start();
        }

        this.cuiForm = new CUI.Form({
            data: this.data,
            name: this.getName(),
            class: this.getClass(),
            fields: this.getFields(),
            horizontal: this.getHorizontal(),
            onDataChanged: () => {
                this.onDataChanged(this.getData());
            }
        }).start();

        return this;
    }

    update() {
        this.cuiForm.opts.fields = this.getFields();
        this.cuiForm.reload();
    }

    render() {
        if (this.subForms.length === 0) {
            return this.cuiForm;
        }

        const above = this.subForms.filter(subForm => subForm.position === 'above').map(subForm => subForm.form.render());
        const below = this.subForms.filter(subForm => subForm.position !== 'above').map(subForm => subForm.form.render());

        return new CUI.VerticalList({
            maximize_horizontal: true,
            content: [...above, this.cuiForm, ...below]
        });
    }
}

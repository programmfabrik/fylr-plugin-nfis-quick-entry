class NfisQuickEntryActionNumberForm extends NfisQuickEntryForm {

    constructor({ poolIds, optionsMap, ...rest } = {}) {
        super(rest);
        this.poolIds = poolIds;
        this.optionsMap = optionsMap;
    }

    getName() {
        return "actionNumberForm";
    }

    getClass() {
        return "nfis-quick-entry-action-number-form";
    }

    getHorizontal() {
        return true;
    }

    getDefaultData() {
        return {
            einrichtung: this.optionsMap.nld_number_range?.[0]?.value || null,
            jahr: '',
            nummer: null,
            zusatz: '',
        };
    }

    getFields() {
        return [
            {
                type: NfisQuickEntrySearchableSelect,
                name: "einrichtung",
                // form: { label: "Einrichtung" },
                options: () => {
                    return this.optionsMap['nld_number_range']
                },
            },
            {
                type: CUI.Input,
                name: "jahr",
                placeholder: "Jahr",
                // form: { label: "Jahr" },
                regexp: "^[0-9]{4}$",
            },
            {
                type: CUI.NumberInput,
                name: "nummer",
                placeholder: "Nummer",
                // form: { label: "Nummer" },
            },
            {
                type: CUI.Input,
                name: "zusatz",
                placeholder: "Zusatz",
                // form: { label: "Zusatz" },
            },
        ];
    }

    render() {
        return new CUI.HorizontalLayout({
            left: {
                content: [
                    new CUI.Label({
                        class: 'nfis-quck-entry-form-label',
                        text: 'Maßnahmennummer'
                    })
                ]
            },
            center: {
                content: [this.cuiForm]
            }
        });
    }
}

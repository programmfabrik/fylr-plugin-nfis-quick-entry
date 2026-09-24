class NfisQuickEntryActionDateForm extends NfisQuickEntryForm {

    constructor({ poolIds, optionsMap, ...rest } = {}) {
        super(rest);
        this.poolIds = poolIds;
        this.optionsMap = optionsMap;
    }

    getName() {
        return "actionDateForm";
    }

    getClass() {
        return "nfis-quick-entry-action-date-range-form";
    }

    getHorizontal() {
        return true;
    }

    getDefaultData() {
        return {
            von: null,
            bis: null,
            genauigkeit: this.optionsMap.subset_nld_date_reliability?.[0]?.value || null,
        };
    }

    getFields() {
        let locale = CUI.DateTime.getLocale()
        let locales = ez5.session.getPref("database_languages") || []
        if (CUI.util.isEmpty(locales)) {
            locales = ez5.session.getConfigDatabaseLanguages()
        }

        return [
            {
                type: CUI.DateTime,
                name: "von",
                placeholder: "Von",
                locale: locales[0] || locale,
                store_invalid: true,
                avoid_bc_conversion: false,
                show_calendar: true,
                input_types: [
                    "date",
                    "year_month",
                    "year"
                ],
                display_type: 'short',
            },
            {
                type: CUI.DateTime,
                name: "bis",
                placeholder: "Bis",
                locale: locales[0] || locale,
                store_invalid: true,
                avoid_bc_conversion: false,
                show_calendar: true,
                input_types: [
                    "date",
                    "year_month",
                    "year"
                ],
                display_type: 'short',
            },
            {
                type: CUI.Select,
                name: "genauigkeit",
                options: () => {
                    return this.optionsMap['subset_nld_date_reliability']
                },
            },
        ];
    }

    render() {
        return new CUI.HorizontalLayout({
            left: {
                content: [
                    new CUI.Label({
                        class: 'nfis-quck-entry-form-label',
                        text: 'Datum'
                    })
                ]
            },
            center: {
                content: [this.cuiForm]
            }
        });
    }
}

class NfisQuickEntryObjectDateRangeForm extends NfisQuickEntryForm {

    constructor({ poolIds, optionsMap, ...rest } = {}) {
        super(rest);
        this.poolIds = poolIds;
        this.optionsMap = optionsMap;
    }

    getName() {
        return "objectDateRangeForm";
    }

    getClass() {
        return "nfis-quick-entry-object-date-range-form";
    }

    getHorizontal() {
        return true;
    }

    getDefaultData() {
        return {
            dateReliabilityFrom: this.optionsMap.subset_nld_date_reliability?.[0]?.value || null,
            dateReliabilityTo: this.optionsMap.subset_nld_date_reliability?.[0]?.value || null,
            from: null,
            to: null,
        };
    }

    getFields() {
        let locale = CUI.DateTime.getLocale()
        let locales = ez5.session.getPref("database_languages") || []
        if (CUI.util.isEmpty(locales)) {
            locales = ez5.session.getConfigDatabaseLanguages()
        }

        const toField = new CUI.DateTime({
            name: "to",
            palceholder: "Bis",
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
        })

        return [
            {
                type: CUI.Select,
                name: "dateReliabilityFrom",
                disabled: (context) => {
                    return this.optionsMap.subset_nld_date_reliability.length <= 1;
                },
                options: () => {
                    return this.optionsMap['subset_nld_date_reliability']
                },
            },
            {
                type: CUI.DateTime,
                name: "from",
                palceholder: "Von",
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
                onDataChanged: (_, field) => {
                    if (this.data[this.getName()].to)
                        return

                    field.focus()
                    const from = this.data[this.getName()].from
                    if (from || from !== "invalid") {
                        toField.setPlaceholder(from)
                    }
                },
                onBlur: () => {
                    if (this.data[this.getName()].to)
                        return

                    const from = this.data[this.getName()].from
                    if (!from || from == "invalid") {
                        this.data[this.getName()].to = null
                    } else {
                        this.data[this.getName()].to = from
                    }
                    toField.reload()

                    CUI.Events.trigger({
                        node: this.cuiForm,
                        type: "editor-changed"
                    })
                    return
                }
            },
            toField,
            {
                type: CUI.Select,
                name: "dateReliabilityTo",
                disabled: (context) => {
                    return this.optionsMap.subset_nld_date_reliability.length <= 1;
                },
                options: () => {
                    return this.optionsMap['subset_nld_date_reliability']
                },
            },
        ];
    }

    render() {
        this.cuiForm;

        return new CUI.HorizontalLayout({

            left: {
                content: [
                    new CUI.Label({
                        class: 'nfis-quck-entry-form-label',
                        text: 'Datierung Entstehung von/bis'
                    })
                ]
            },
            center: {
                content: [this.cuiForm]
            }

        })

        return new CUI.VerticalList({
            maximize_horizontal: true,
            content: [...above, this.cuiForm, ...below]
        });
    }
}

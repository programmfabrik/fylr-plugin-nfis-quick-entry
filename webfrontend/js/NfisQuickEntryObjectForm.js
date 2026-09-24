class NfisQuickEntryObjectForm extends NfisQuickEntryForm {

    constructor({ poolIds, optionsMap, ...rest } = {}) {
        super(rest);
        this.poolIds = poolIds;
        this.optionsMap = optionsMap;
    }

    getName() {
        return "objectForm";
    }

    getSubForms() {
        return [
            {
                form: new NfisQuickEntryRepeatingForm({
                    name: 'datierungen',
                    rowFormClass: NfisQuickEntryObjectDateRangeForm,
                    rowFormOpts: {
                        poolIds: this.poolIds,
                        optionsMap: this.optionsMap,
                    },
                    addButtonText: 'Datierung hinzufügen',
                    minRows: 1,
                }),
                position: 'above'
            }
        ];
    }

    getDefaultData() {
        const today = new Date();
        const datum = today.getFullYear() + '-' +
            String(today.getMonth() + 1).padStart(2, '0') + '-' +
            String(today.getDate()).padStart(2, '0');

        return {
            lagebeschreibung: '',
            fundstelleBeschreibung: '',
            datierung: '',
            historischeBezuege: '',
            hinweis: '',
            // benutzer: ez5.session.user.data,
            benutzer: ez5.session.user.data.user._generated_displayname,
            datum: datum,
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
                type: CUI.Input,
                name: 'lagebeschreibung',
                form: { label: 'Lagebeschreibung / Name' },
                textarea: true
            },
            {
                type: CUI.Input,
                name: 'fundstelleBeschreibung',
                form: { label: 'Beschreibung der Fundstelle' },
                textarea: true
            },
            {
                type: CUI.Input,
                name: 'datierung',
                form: { label: 'Datierung / Interpretation' },
                textarea: true
            },
            {
                type: CUI.Input,
                name: 'historischeBezuege',
                form: { label: 'Historische Bezüge' },
                textarea: true
            },
            {
                type: CUI.Input,
                name: 'hinweis',
                form: { label: 'Hinweise zur denkmalpflegerischen Praxis' },
                textarea: true
            },
            // {
            //     type: UserGroupSelector,
            //     name: 'benutzer',
            //     form: { label: 'Datensatz eingetragen von' },
            //     undo_and_changed_support: false,
            //     aclWhoManager: new AclWhoManager({ who_filter: ["user"] })
            // },
            {
                type: CUI.Input,
                name: 'benutzer',
                form: { label: 'Datensatz eingetragen von' },
            },
            {
                type: CUI.DateTime,
                name: "datum",
                form: { label: 'Datensatz eingetragen am' },
                locale: locales[0] || locale,
                store_invalid: true,
                avoid_bc_conversion: false,
                show_calendar: true,
                input_types: [
                    "date",
                ],
                display_type: 'short',
            },
        ];
    }
}

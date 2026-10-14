class NfisQuickEntryActionForm extends NfisQuickEntryForm {

    constructor({ poolIds, optionsMap, ...rest } = {}) {
        super(rest);
        this.poolIds = poolIds;
        this.optionsMap = optionsMap;
    }

    getName() {
        return "actionForm";
    }

    getClass() {
        return "nfis-quit-entry-action-form"
    }

    getSubForms() {
        return [
            {
                form: new NfisQuickEntryActionNumberForm({
                    poolIds: this.poolIds,
                    optionsMap: this.optionsMap,
                }),
                position: 'above'
            },
            {
                form: new NfisQuickEntryActionDateForm({
                    poolIds: this.poolIds,
                    optionsMap: this.optionsMap,
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
            institution: null,
            massnahmenart: null,
            ursache: null,
            beschreibungDerMassnahme: '',
            beschreibungFunde: '',
            firma: null,
            // benutzer: ez5.session.user.data,
            benutzer: ez5.session.user?.data?.user?._generated_displayname || '',
            datum: datum,
            finder: null,
            fundmelder: null
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
                type: NfisQuickEntryDanteSearchableSelect,
                name: "institution",
                form: { label: "Institution" },
                vocab: 'subset_nld_actor_institution',
            },
            {
                type: NfisQuickEntryDanteSearchableSelect,
                name: "massnahmenart",
                form: { label: "Art der Maßnahme" },
                vocab: 'nld_measure_type',
            },
            {
                type: NfisQuickEntryDanteSearchableSelect,
                name: "ursache",
                form: { label: "Ursache" },
                vocab: 'nld_measure_reason',
            },
            {
                type: CUI.Input,
                name: 'beschreibungDerMassnahme',
                form: { label: 'Beschreibung der Maßnahme' },
                textarea: true
            },
            {
                type: CUI.Input,
                name: 'beschreibungFunde',
                form: { label: 'Beschreibung Funde' },
                textarea: true
            },
            {
                type: NfisQuickEntryDanteSearchableSelect,
                name: "firma",
                form: { label: "Firma" },
                vocab: 'nld_archaeological_service_provider',
            },
            {
                type: NfisQuickEntrySearchableSelect,
                name: "finder",
                form: { label: "Finder" },
                options: () => {
                    return this.optionsMap['personen_massnahmen']
                },
            },
            {
                type: NfisQuickEntrySearchableSelect,
                name: "fundmelder",
                form: { label: "Fundmelder" },
                options: () => {
                    return this.optionsMap['personen_massnahmen']
                },
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

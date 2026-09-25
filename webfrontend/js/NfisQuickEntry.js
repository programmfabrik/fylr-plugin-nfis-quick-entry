class NfisQuickEntry extends RootMenuApp {

    // Ablauf
    // state: init => Lade Pools und Optionen für start state
    // state: start => Pool und Germarkung auswählen
    // state: loading => Fläche und Objekt über API anlegen, Objekt mit Fläche verknüpfen über FStNr
    // state: object => Metadaten für das Objekt erfassen
    // state: loading => Metadaten für Objekt speichern
    // Popup mit Frage ob eine Maßnahme angelegt werden soll
    // (optional branch) state: loading => falls question mit ja beantwortet wurde, anlegen von Maßnahme über API
    // (optional branch) state: action => Erfassen der Metadaten zur Maßnahme
    // (optional branch) state loading => Speichern der Metadaten zur Maßnahme
    // state: end => Anzeige der angelegten Objekte und Frage ob eine weitere Fundstelle angelegt werden soll
    constructor() {
        super()
        this.accessToken = ez5.session.data.access_token
        this.title = 'Neue Fundstelle'
        this.__state = 'init'
        this.forms = new Map();
        this.createdFlaeche = null;
        this.createdObject = null;
        this.createdAction = null;
        this.poolIds = [];
        this.optionsMap = {
            vocab: [
                { value: 'no_vocab', text: 'Bitte auswählen' },
                { value: 'niedersachsen', text: 'Niedersachsen' },
                { value: 'bremen', text: 'Bremen' },
            ],
            no_vocab: [{ value: null, text: 'Bitte zuerst Vokabular auswählen' }],
            nld_gemarkung_niedersachsen: [{ value: null, text: 'Bitte auswählen' }],
            nld_gemarkung_bremen: [{ value: null, text: 'Bitte auswählen' }],
            subset_nld_date_reliability: [{ value: null, text: 'Bitte auswählen' }],
            nld_object_type: [{ value: null, text: 'Bitte auswählen' }],
            nld_object_category: [{ value: null, text: 'Bitte auswählen' }],
            nld_number_range: [{ value: null, text: 'Bitte auswählen' }],
            subset_nld_actor_institution: [{ value: null, text: 'Bitte auswählen' }],
            nld_measure_type: [{ value: null, text: 'Bitte auswählen' }],
            nld_measure_reason: [{ value: null, text: 'Bitte auswählen' }],
            nld_archaeological_service_provider: [{ value: null, text: 'Bitte auswählen' }],
            personen_massnahmen: [{ value: null, text: 'Bitte auswählen' }]
        };
        this.objectTypeMaskMap = {
            personen_massnahmen: null,
        }
        this.__newFormActionButton = null;
        this.__objectFormActionButton = null;
        this.__actionFormActionButton = null;

    }

    static is_allowed() {
        return true;
    }

    static group() {
        return "nfis-quick-entry";
    }

    static label() {
        return "fylr-plugin-nfis-quick-entry.app.label";
    }

    static isStartApp() {
        return false;
    }

    static path() {
        return ["nfis-quick-entry"];
    }

    allow_unload() {
        return CUI.confirm({ text: "Wollen Sie die Schnellerfassung verlassen? Nicht gespeicherte Daten werden verworfen." });
    }

    unload() {
        ez5.rootLayout.empty("center");
        return super.unload();
    }

    // load() {
    //     super.load();
    //     this.__plugin = ez5.pluginManager.getPlugin("fylr-plugin-nfis-quick-entry");

    //     const itemList = new CUI.ItemList({
    //         class: "nfis-quick-entry-itemlist",
    //         items: [
    //             {
    //                 active: true,
    //                 loca_key: "nfis-quick-entry.item1",
    //                 onClick: () => { this.__showSimpleElements(); }
    //             },
    //             {
    //                 loca_key: "nfis-quick-entry.item2",
    //                 onClick: () => { this.__showTemplate(); }
    //             },
    //             {
    //                 loca_key: "nfis-quick-entry.item3",
    //                 onClick: () => { this.__showTemplateTwo(); }
    //             },
    //             {
    //                 loca_key: "nfis-quick-entry.item4",
    //                 onClick: () => { this.__showConfig(); }
    //             }
    //         ]
    //     });

    //     itemList.render();
    //     this.__horizontalLayout = new CUI.HorizontalLayout({
    //         left: {
    //             class: "ez5-nfis-quick-entry-hl-left",
    //             content: [itemList]
    //         }
    //     });

    //     ez5.rootLayout.replace(this.__horizontalLayout, "center");

    //     return CUI.resolvedPromise();
    // }

    load() {
        super.load();
        this.__getNextNumber('a')
        this.setState('loading')
        this.__plugin = ez5.pluginManager.getPlugin("fylr-plugin-nfis-quick-entry");

        Promise.all([
            this.__getPoolIds(),
            this.getOptionsFromDanteApi('nld_gemarkung_niedersachsen'),
            this.getOptionsFromDanteApi('nld_gemarkung_bremen'),
            this.getOptionsFromDanteApi('areal_unit_niedersachsen'),
            this.getOptionsFromDanteApi('areal_unit_bremen'),
            this.getOptionsFromDanteApi('subset_nld_date_reliability'),
            this.getOptionsFromDanteApi('nld_object_type'),
            this.getOptionsFromDanteApi('nld_object_category'),
            this.getOptionsFromDanteApi('nld_number_range'),
            this.getOptionsFromDanteApi('subset_nld_actor_institution'),
            this.getOptionsFromDanteApi('nld_measure_type'),
            this.getOptionsFromDanteApi('nld_measure_reason'),
            this.getOptionsFromDanteApi('nld_archaeological_service_provider'),
            this.getOptionsFromInternalList('personen_massnahmen'),
        ]).then(() => {
            this.setState('new')
            // this.setState('object') // debug
            // this.setState('action') // debug
        })

        this.__updateLayout()


        return CUI.resolvedPromise();
    }

    async __getPoolIds() {
        return new Promise(async (resolve, reject) => {
            const access_token = ez5.session.data.access_token

            const response = await fetch("/api/v1/pool", {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${access_token}`
                },
            });
            if (!response.ok) {
                this.poolIds = []
                resolve()
            }

            const pools = await response.json()
            console.log(pools);

            this.poolIds = pools.map(pool => pool.pool._id)
            resolve();
        })
    }

    __processDanteOptionsResponse(response, vocabName) {
        if (!Array.isArray(response?.[1]) || !Array.isArray(response?.[3])) {
            return;
        }
        const options = [{ value: null, text: 'Bitte auswählen' }]
        for (let i = 0; i < response[1].length; i++) {
            const text = response[1][i];
            const uri = response[3][i];
            options.push({
                text: text,
                value: uri,
            });
        }
        this.optionsMap[vocabName] = options;
    }

    __getOrCreateForm(FormClass, onDataChanged) {
        if (!this.forms.has(FormClass)) {
            this.forms.set(FormClass, new FormClass({
                poolIds: this.poolIds,
                optionsMap: this.optionsMap,
                onDataChanged: onDataChanged || (() => { })
            }).start());
        }

        return this.forms.get(FormClass);
    }

    __updateLayout() {
        const verticalListContent = this.__getVerticalListLayoutContent()

        const verticalListLayout = new CUI.VerticalList({
            class: 'nfis-quick-entry-form-container',
            content: verticalListContent
        });
        const horizontalLayout = new CUI.HorizontalLayout({
            center: {
                content: [verticalListLayout]
            }
        });

        ez5.rootLayout.replace(horizontalLayout, "center");
    }

    __getVerticalListLayoutContent() {
        const content = [this.__getTitleElement()];
        switch (this.__state) {
            case 'init':
            case 'loading':
                content.push(new CUI.Icon({ class: "fa-spinner fa-spin nfis-quick-entry-loading-spinner" }))
                break;
            case 'new':
                content.push(...this.__getVerticalListLayoutContentForNewState())
                break;
            case 'object':
                content.push(...this.__getVerticalListLayoutContentForObjectState())
                break;
            case 'action':
                content.push(...this.__getVerticalListLayoutContentForActionState())
                break;
        }
        return content;
    }

    __getVerticalListLayoutContentForNewState() {
        const form = this.__getOrCreateForm(NfisQuickEntryNewForm, (formData) => {
            this.__updateNewFormActionButtonVisibility(formData)
            console.log(this.__getNextNumber(formData.gemarkung));

        })

        if (!this.__newFormActionButton) {
            this.__newFormActionButton = new CUI.Button({
                text: 'Fundstelle erstellen',
                primary: true,
                onClick: (e, button) => {
                    CUI.confirm({
                        text: 'Wollen Sie eine neue Fundstelle anlegen?'
                    }).done((res) => {
                        const submitData = form.getData()
                        console.log('confirmed');
                        console.log('submitted form data', submitData);
                        this.setState('loading')

                        // this.createFlaeche().then(() => {
                        //     this.createObject().then(() => {
                        //         this.setState('object')
                        //     })
                        // })
                        setTimeout(() => { this.setState('object') }, 6000)
                    })
                }
            })
        }

        this.__updateNewFormActionButtonVisibility(form.getData())

        return [
            form.render(),
            new CUI.HorizontalLayout({
                right: {
                    content: [this.__newFormActionButton]
                }
            })
        ]
    }

    __getVerticalListLayoutContentForObjectState() {
        const form = this.__getOrCreateForm(NfisQuickEntryObjectForm, (formData) => {
            console.log(formData);

        })

        if (!this.__objectFormActionButton) {
            this.__objectFormActionButton = new CUI.Button({
                text: 'Speichern',
                primary: true,
                onClick: (e, button) => {
                    // TODO: send object form data to api
                    this.setState('loading')
                    // this.updateObject().then(() => {
                    //     CUI.confirm({
                    //         text: 'Wollen Sie die zugehörige Maßnahme anlegen?',
                    //         button_text_ok: 'Ja',
                    //         button_text_cancel: 'Nein',
                    //     }).done((res) => {
                    //         this.setState('action')
                    //     }).fail(() => {
                    //         this.__reset()
                    //         this.setState('new')
                    //     })
                    // })
                    CUI.confirm({
                        text: 'Wollen Sie die zugehörige Maßnahme anlegen?',
                        button_text_ok: 'Ja',
                        button_text_cancel: 'Nein',
                    }).done((res) => {
                        this.setState('action')
                    }).fail(() => {
                        this.__reset()
                        this.setState('new')
                    })
                }
            })
        }

        return [
            form.render(),
            new CUI.HorizontalLayout({
                right: {
                    content: [this.__objectFormActionButton]
                }
            })
        ]
    }

    __getVerticalListLayoutContentForActionState() {
        const form = this.__getOrCreateForm(NfisQuickEntryActionForm, (formData) => {
            console.log(formData);
        })

        if (!this.__actionFormActionButton) {
            this.__actionFormActionButton = new CUI.Button({
                text: 'Maßnahme speichern',
                primary: true,
                onClick: (e, button) => {
                    CUI.confirm({
                        text: 'Wollen Sie die Maßnahme jetzt anlegen?'
                    }).done((res) => {
                        const submitData = form.getData()
                        console.log('confirmed');
                        console.log('submitted form data', submitData);
                        this.setState('loading')
                        // TODO: Send action form data to API, after response => Change state
                        // this.createAction().then(() => {
                        //     // TODO: Create state that shows links to the created object and offers to restart the process
                        //     this.__reset()
                        //     this.setState('new')
                        // })
                        setTimeout(() => {
                            this.__reset()
                            this.setState('new')
                        }, 6000)
                    })
                }
            })
        }

        return [
            form.render(),
            new CUI.HorizontalLayout({
                right: {
                    content: [this.__actionFormActionButton]
                }
            })
        ]
    }

    __updateNewFormActionButtonVisibility(formData) {
        if (!this.__newFormActionButton) {
            return
        }
        const showButton = formData.gemarkung &&
            formData.politicalAffiliation &&
            formData.pool &&
            formData.objectType &&
            formData.objectCategory
        if (showButton) {
            this.__newFormActionButton.show()
        } else {
            this.__newFormActionButton.hide()
        }
    }

    __getTitleElement() {
        const element = CUI.dom.h4('h4')
        element.textContent = this.title
        return element
    }

    __getNextNumber(fundstelleUri) {
        const config = ez5.session.getBaseConfig("plugin", "numeric-id-auto-incrementer");
        if (!config) return null;
        const idFieldName = config.numericIdAutoIncrementer.incrementer_id_field_name
        const valuesFieldName = config.numericIdAutoIncrementer.incrementer_values_field_name
        const objectType = config.numericIdAutoIncrementer.incrementer_object_type

        console.log({
            idFieldName,
            valuesFieldName,
            objectType
        });

        // TODO: Get counter object with zaehler_id 'fundstellennummer' and extract the current counter for the uri and return it
    }

    __reset() {
        this.forms = new Map();
        this.__newFormActionButton = null;
        this.__objectFormActionButton = null;
        this.__actionFormActionButton = null;
    }

    setState(newState) {
        this.__state = newState
        this.__updateLayout()
    }






    // __showSimpleElements() {
    //     const title = new CUI.Label({ text: "Hello world" });
    //     const text = new CUI.Label({
    //         text: "Lorem Ipsum Dolor Sit amet",
    //         multiline: true
    //     });

    //     const data = {
    //         example_data: {
    //             version: "original",
    //             name: "file.jpg",
    //             another_value: "foo"
    //         }
    //     };

    //     const form_example = new CUI.Form({
    //         data: data,
    //         name: "example_data",
    //         fields: [
    //             {
    //                 type: CUI.Output,
    //                 name: "name",
    //                 form: { label: "File name" }
    //             },
    //             {
    //                 type: CUI.Select,
    //                 name: "version",
    //                 form: { label: "Version" },
    //                 options: () => {
    //                     const options = ["original", "var", "foo", "bar"];
    //                     return options.map((option) => ({ value: option, text: "Option --> " + option }));
    //                 }
    //             },
    //             {
    //                 type: CUI.Output,
    //                 name: "another_value",
    //                 form: { label: "Another value" }
    //             }
    //         ],
    //         onDataChanged: (changedData) => {
    //             changedData.another_value = changedData.version
    //             const fields = form_example.opts.fields
    //             const fieldLength = fields.length
    //             changedData['field_' + fieldLength] = fieldLength
    //             fields.push({
    //                 type: CUI.Output,
    //                 name: 'field_' + fieldLength,
    //                 form: { label: "Field " + fieldLength }
    //             })
    //             form_example.opts.fields = fields;

    //             console.log("Data changed", changedData);
    //             form_example.updateData(changedData);
    //             form_example.reload()
    //         }
    //     });

    //     const verticalListLayout = new CUI.VerticalList({
    //         content: [
    //             title,
    //             text,
    //             form_example.start()
    //         ]
    //     });
    //     this.__horizontalLayout.replace(verticalListLayout, "center");
    // }

    // __showTemplate() {
    //     const htmlTemplate = new CUI.Template({ name: "nfis-quick-entry-template-1" });
    //     this.__horizontalLayout.replace(htmlTemplate, "center");
    // }

    // __showTemplateTwo() {
    //     const inputData = {};
    //     const htmlTemplate = new CUI.Template({
    //         name: "nfis-quick-entry-template-2",
    //         map: {
    //             slot1: true,
    //             slot3: true
    //         }
    //     });
    //     htmlTemplate.map.slot1.append(new CUI.Label({ text: "Lorem Ipsum" }));
    //     htmlTemplate.map.slot3.append(new CUI.Button({
    //         text: "A button",
    //         onClick: () => { CUI.confirm({ text: "Hello im a button!" }); }
    //     }));
    //     this.__horizontalLayout.replace(htmlTemplate, "center");
    // }

    // __showConfig() {
    //     const config = ez5.session.getBaseConfig("plugin", "fylr-plugin-nfis-quick-entry");
    //     const configDump = new CUI.ObjectDumper({ object: config });
    //     this.__horizontalLayout.replace(configDump, "center");
    // }




    async getOptionsFromDanteApi(vocab) {
        const response = await fetch(`https://api.dante.gbv.de/suggest?search=&voc=${vocab}&language=de&limit=1000&cache=0&ancestors=`);
        if (response.ok) {
            const json = await response.json()
            this.__processDanteOptionsResponse(json, vocab)
            return json
        }
        else return [{ value: null, text: 'Bitte auswählen' }]
    }

    async getOptionsFromInternalList(objectType) {
        const total = await this.getInternalListCount(objectType)
        const url = '/api/v1/search?debug=SearchBasics.init&pretty=0'
        const limit = 200
        const promises = []

        for (let offset = 0; offset < total; offset += limit) {
            const payload = {
                "offset": offset,
                "limit": limit,
                "aggregations": {
                    "_result_table_masks": {
                        "type": "term",
                        "limit": 100000,
                        "field": "_mask"
                    }
                },
                "generate_rights": false,
                "search": [],
                "format": "standard",
                "sort": [
                    {
                        "field": "_standard.1.text",
                        "order": "ASC",
                        "_level": 0
                    }
                ],
                "objecttypes": [
                    objectType
                ],
            }
            const promise = fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + this.accessToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })
            promises.push(promise)
        }

        const responses = await Promise.all(promises)

        const options = [{ value: null, text: 'Bitte auswählen' }]
        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const responseJson = await response.json()
            if (!this.objectTypeMaskMap[objectType]) {
                this.objectTypeMaskMap[objectType] = responseJson.aggregations._result_table_masks.terms[0].term
            }
            for (let i = 0; i < responseJson.objects.length; i++) {
                const object = responseJson.objects[i];
                const text = object._standard[1].text["de-DE"]
                const value = object._global_object_id
                options.push({
                    text: text,
                    value: value,
                });
            }
        }

        this.optionsMap[objectType] = options
    }

    async getInternalListCount(objectType) {
        const url = '/api/v1/search?debug=SearchBasics.init&pretty=0'
        const payload = {
            "type": "object",
            "objecttypes": [
                objectType
            ],
            "search": [],
            "format": "short",
            "limit": 0,
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + this.accessToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })
        await this._assertResponseOk(response, 'getInternalListCount')

        const { count } = await response.json()
        return count || 0
    }

    async getDanteJSKOS(uri) {
        if (!uri) return null
        const response = await fetch('https://api.dante.gbv.de/data?cache=1&uri=' + encodeURIComponent(uri) + '&properties=+hiddenLabel,notation,scopeNote,definition,identifier,example,location,startDate,endDate,startPlace,endPlace,ancestors')

        this._assertResponseOk(response, 'get dante jskos ' + uri)
        const resultJSON = await response.json()
        const jskos = resultJSON[0]
        const databaseLanguages = CustomDataTypeDANTE.prototype.getDatabaseLanguages()
        const geojson = DANTEUtil.getGeoJSONFromDANTEJSKOS(jskos)
        const ancestors = []

        for (let i = 0; i < jskos.ancestors.length; i++) {
            const ancestor = jskos.ancestors[i];
            ancestors.push(ancestor.uri)
        }

        const data = {
            "conceptName": DANTEUtil.getConceptNameFromJSKOSObject(jskos, 'de'),
            "conceptURI": uri,
            "frontendLanguage": "de",
            "_fulltext": DANTEUtil.getFullTextFromJSKOSObject(jskos, databaseLanguages),
            "_standard": DANTEUtil.getStandardFromJSKOSObject(jskos, databaseLanguages),
            "conceptAncestors": ancestors.join(" "),
            "facetTerm": DANTEUtil.getFacetTermFromJSKOSObject(jskos, databaseLanguages, false)
        }

        if (geojson) {
            data.conceptGeoJSON = geojson
        }

        return data;
    }

    async getAnnotationObject(annotationTypeUri, text, verfasser = null, datum = null) {
        const annotationType = await this.getDanteJSKOS(annotationTypeUri)
        const datumObject = datum ? { "value": datum } : null
        return {
            "text": text,
            "lk_anmerkungstyp": annotationType,
            "verfasser": verfasser,
            "datum": datumObject
        }
    }

    async getCreationEvents(dates) {
        const dateReliabilityMap = {}
        const events = [];
        // Event-Typ Entstehung
        const eventType = await this.getDanteJSKOS("http://uri.gbv.de/terminology/object_related_event/4d52f1c2-2d21-44cb-8097-63d5ac7c1d40")

        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            if (!date.from || !date.to) continue;
            if (!dateReliabilityMap[date.dateReliabilityFrom]) {
                dateReliabilityMap[date.dateReliabilityFrom] = await this.getDanteJSKOS(date.dateReliabilityFrom)
            }
            if (!dateReliabilityMap[date.dateReliabilityTo]) {
                dateReliabilityMap[date.dateReliabilityTo] = await this.getDanteJSKOS(date.dateReliabilityTo)
            }

            events.push({
                "lk_eventtyp": eventType,
                "lk_veroeffentlichen": {
                    "_objecttype": "ja_nein_objekttyp",
                    "_mask": "ja_nein_objekttyp__all_fields",
                    "_global_object_id": "827@0437869f-aa50-498f-a0a5-a3b02be67dcc",
                    "ja_nein_objekttyp": {
                        "_id": 1
                    }
                },
                "titel": null,
                "lk_baumassnahmenart": null,
                "_nested:item__event__nutzungsart": [],
                "lk_status": null,
                "lk_datum_von_sicherheit": dateReliabilityMap[date.dateReliabilityFrom],
                "datumsbereich": {
                    "from": date.from,
                    "to": date.to
                },
                "lk_datum_bis_sicherheit": dateReliabilityMap[date.dateReliabilityTo],
                "datierung_verbal": null,
                "lk_zeitstellung": null,
                "lk_zeitstellung_genauigkeit": null,
                "lk_kultur": null,
                "lk_kultur_genauigkeit": null,
                "bemerkung": null,
                "bemerkung_verfasser": null,
                "bemerkung_datum": null,
                "datum_ausweisung_beginn": null,
                "datum_benachrichtigung": null,
                "lk_ausweisungsursache": null,
                "lk_ausweisungsstelle": null,
                "datum_rechtsgrundlage": null,
                "uri_rechtsgrundlage": null,
                "_nested:item__event__bedeutung": [],
                "_nested:item__event__schutzgruende": [],
                "_nested:item__event__person_institution": [],
                "_nested:item__event__ort": [],
                "ausgangszustand": null,
                "lk_bilddatenbank": null
            })
        }

        return events
    }

    async createFlaeche() {
        const form = this.__getOrCreateForm(NfisQuickEntryNewForm);
        const formData = form.getData()
        const url = '/api/v1/db/flaeche?priority=2&format=long'

        const danteGemarkung = await this.getDanteJSKOS(formData.gemarkung)
        const danteFundstellennummer = await this.getDanteJSKOS('http://uri.gbv.de/terminology/nld_area_type/1d59bd25-81ea-4e17-b786-7677c595ab1c')

        const payload = [
            {
                "flaeche": {
                    "_pool": {
                        "pool": {
                            "_id": formData.pool.pool._id
                        }
                    },
                    "_id": null,
                    "_version": 1,
                    "lk_dante_art": danteFundstellennummer,
                    "titel": null,
                    "_nested:flaeche__fundstellennummer": [
                        {
                            "lk_dante_gemarkung": danteGemarkung
                        }
                    ],
                    "_reverse_nested:flaeche__bild:lk_flaeche": [],
                    "lk_bilddatenbank": null,
                    "_nested:flaeche__dokumente": [],
                    "_nested:flaeche__identifier": [],
                    "_nested:flaeche__politische_zugehoerigkeit": [],
                    "lk_nfis_geometrie": {
                        "geometry_ids": []
                    },
                    "_nested:flaeche__nutzungen": [],
                    "_nested:flaeche__beschreibung": [],
                    "_nested:flaeche__anmerkung_intern": [],
                    "_nested:flaeche__ausweisung": [],
                    "_reverse_nested:flaeche__objekt:lk_flaeche": [],
                    "_reverse_nested:flaeche__massnahme:lk_flaeche": [],
                    "_nested:flaeche__e_akte": []
                },
                "_mask": "flaeche__all_fields",
                "_objecttype": "flaeche",
                "_idx_in_objects": 1
            }
        ]

        const responseJson = await this.sendDataToApi(url, payload)
        this.createdFlaeche = responseJson[0]
    }

    async createObject() {
        const form = this.__getOrCreateForm(NfisQuickEntryObjectForm);
        const formData = form.getData()
        const url = '/api/v1/db/item?priority=2&format=long'

        const dantePoliticalAffiliation = await this.getDanteJSKOS(formData.politicalAffiliation)
        const danteObjectType = await this.getDanteJSKOS(formData.objectType)
        const danteObjectCategory = await this.getDanteJSKOS(formData.objectCategory)
        const danteDesignationEventType = await this.getDanteJSKOS("http://uri.gbv.de/terminology/object_related_event/978eb685-12d0-45d2-ac64-77bc64b7de0b");
        const danteDesignationEventStatus = await this.getDanteJSKOS("http://uri.gbv.de/terminology/nld_designation_status/7eb175f5-32cd-4849-a2dd-1d46e039fdc4");
        const flaeche = {
            "_objecttype": this.createdFlaeche._objecttype,
            "_mask": this.createdFlaeche._mask,
            "_global_object_id": this.createdFlaeche._global_object_id,
            "flaeche": {
                "_id": this.createdFlaeche.flaeche._id
            }
        }

        const payload = [{
            "item": {
                "_pool": {
                    "pool": {
                        "_id": formData.pool.pool._id
                    }
                },
                "_id": null,
                "_version": 1,
                "_parents": [],
                "_reverse_nested:objekt__bild:lk_objekt": [],
                "lk_bilddatenbank": null,
                "_nested:item__dokumente": [],
                "_nested:item__identifier": [],
                "_nested:item__titel": [
                    {
                        "titel": "Platzhalter (sollte durch anderes Plugin gesetzt werden)"
                    }
                ],
                "lk_objekttyp": danteObjectType,
                "objekttyp_ergaenzung": null,
                "lk_objekttyp_gesichert": null,
                "_nested:item__objektkategorie": [
                    danteObjectCategory
                ],
                "lk_obertaegig": null,
                "erhaltene_hoehe_in_m": null,
                "_nested:item__planung": [],
                "_nested:item__politische_zugehoerigkeit": [dantePoliticalAffiliation],
                "_nested:item__ehemalige_gebietszugehoerigkeit": [],
                "_nested:item__anschrift": [],
                "lk_nfis_geometrie": {
                    "geometry_ids": []
                },
                "lk_topographie": null,
                "_nested:item__beschreibung": [],
                "_nested:item__thema": [],
                "_nested:item__anmerkung_intern": [],
                "_nested:item__event": [
                    {
                        "lk_eventtyp": danteDesignationEventType,
                        "lk_veroeffentlichen": {
                            "_objecttype": "ja_nein_objekttyp",
                            "_mask": "ja_nein_objekttyp__all_fields",
                            "_global_object_id": "827@0437869f-aa50-498f-a0a5-a3b02be67dcc",
                            "ja_nein_objekttyp": {
                                "_id": 1
                            }
                        },
                        "titel": null,
                        "lk_baumassnahmenart": null,
                        "_nested:item__event__nutzungsart": [],
                        "lk_status": danteDesignationEventStatus,
                        "lk_datum_von_sicherheit": null,
                        "datumsbereich": null,
                        "lk_datum_bis_sicherheit": null,
                        "datierung_verbal": null,
                        "lk_zeitstellung": null,
                        "lk_zeitstellung_genauigkeit": null,
                        "lk_kultur": null,
                        "lk_kultur_genauigkeit": null,
                        "bemerkung": null,
                        "bemerkung_verfasser": null,
                        "bemerkung_datum": null,
                        "datum_ausweisung_beginn": null,
                        "datum_benachrichtigung": null,
                        "lk_ausweisungsursache": null,
                        "lk_ausweisungsstelle": null,
                        "datum_rechtsgrundlage": null,
                        "uri_rechtsgrundlage": null,
                        "_nested:item__event__bedeutung": [],
                        "_nested:item__event__schutzgruende": [],
                        "_nested:item__event__person_institution": [],
                        "_nested:item__event__ort": [],
                        "ausgangszustand": null,
                        "lk_bilddatenbank": null
                    }
                ],
                "_nested:item__literatur": [],
                "_nested:item__objektreferenz_intern": [],
                "_nested:item__objektreferez_extern": [],
                "_reverse_nested:massnahme__objekt:lk_objekt": [],
                "_reverse_nested:flaeche__objekt:lk_objekt": [
                    {
                        "_pool": {
                            "pool": {
                                "_id": formData.pool.pool._id
                            }
                        },
                        "_id": null,
                        "lk_flaeche": flaeche,
                        "__idx": 0,
                        "_version": this.createdFlaeche.flaeche._version
                    }
                ],
                "_nested:item__e_akte": [],
                "_nested:item__alte_plan_ids": []
            },
            "_mask": "item__all_fields",
            "_objecttype": "item",
            "_tags": [
                {
                    "_id": 2
                },
                {
                    "_id": 3
                },
                {
                    "_id": 8
                }
            ],
            "_idx_in_objects": 1
        }]

        const responseJson = await this.sendDataToApi(url, payload)
        this.createdObject = responseJson[0]
    }

    async updateObject() {
        const form = this.__getOrCreateForm(NfisQuickEntryObjectForm);
        const formData = form.getData()
        const url = '/api/v1/db/item?priority=2&format=long'
        const object = structuredClone(this.createdObject)
        object.item._version += 1;

        const descriptions = structuredClone(object.item["_nested:item__beschreibung"]);
        const annotations = structuredClone(object.item["_nested:item__anmerkung_intern"]);
        const events = structuredClone(object.item["_nested:item__event"]);

        // Beschreibung
        if (formData.fundstelleBeschreibung) {
            // TODO: Not sure if that's the correct description type => ask to make sure
            const descriptionType = await this.getDanteJSKOS("http://uri.gbv.de/terminology/nld_description_type/3000dc03-7089-45ad-8f62-170c34d3f8b8")

            descriptions.push({
                "lk_beschreibungstyp": descriptionType,
                "lk_veroeffentlichen": {
                    "_objecttype": "ja_nein_objekttyp",
                    "_mask": "ja_nein_objekttyp__all_fields",
                    "_global_object_id": "827@0437869f-aa50-498f-a0a5-a3b02be67dcc",
                    "ja_nein_objekttyp": {
                        "_id": 1
                    }
                },
                "text": formData.fundstelleBeschreibung,
                "quelle": null,
                "verfasser": null,
                "datum": null
            })
        }

        // Anmerkungen
        if (formData.lagebeschreibung) {
            const annotation = await this.getAnnotationObject(
                "http://uri.gbv.de/terminology/nld_comment_type/a0de80c7-ad85-49ce-b79f-eff00ac34b02",
                formData.lagebeschreibung
            )
            annotations.push(annotation)
        }
        if (formData.datierung) {
            const annotation = await this.getAnnotationObject(
                "http://uri.gbv.de/terminology/nld_comment_type/7dd5a846-1d69-4da8-a5c0-b01a3b3a3f3b",
                formData.datierung
            )
            annotations.push(annotation)
        }
        if (formData.historischeBezuege) {
            const annotation = await this.getAnnotationObject(
                "http://uri.gbv.de/terminology/nld_comment_type/7c1e75b0-715b-4209-88e2-b1129a3eafe3",
                formData.historischeBezuege
            )
            annotations.push(annotation)
        }
        if (formData.hinweis) {
            const annotation = await this.getAnnotationObject(
                "http://uri.gbv.de/terminology/nld_comment_type/61aa50a2-6e48-431e-aaa9-07e6aaac8e44",
                formData.hinweis
            )
            annotations.push(annotation)
        }
        if (formData.benutzer && formData.datum) {
            const annotation = await this.getAnnotationObject(
                "http://uri.gbv.de/terminology/nld_comment_type/f0583bd5-e276-4ce1-b2e4-1c8576ff3562",
                "Datensatz erstellt",
                formData.benutzer,
                formData.datum
            )
            annotations.push(annotation)
        }

        // Ereignisse (Entstehungen)
        const creationEvents = await this.getCreationEvents(formData.datierungen)


        object.item["_nested:item__beschreibung"] = descriptions
        object.item["_nested:item__anmerkung_intern"] = annotations
        object.item["_nested:item__event"] = [...creationEvents, ...events]

        const payload = [object]
        const responseJson = await this.sendDataToApi(url, payload)
        this.createdObject = responseJson[0]
    }

    async createAction() {
        // TODO: check which fields are mandatory and only include the others if they are set.
        const form = this.__getOrCreateForm(NfisQuickEntryActionForm);
        const formData = form.getData()
        const url = '/api/v1/db/massnahme?priority=2&format=long'

        const einrichtung = await this.getDanteJSKOS(formData.actionNumberForm.einrichtung)
        const institution = await this.getDanteJSKOS(formData.institution)
        const massnahmenart = await this.getDanteJSKOS(formData.massnahmenart)
        const datierungQualifier = await this.getDanteJSKOS(formData.actionDateForm.genauigkeit)
        const ursache = await this.getDanteJSKOS(formData.ursache)
        const flaeche = {
            "_objecttype": this.createdFlaeche._objecttype,
            "_mask": this.createdFlaeche._mask,
            "_global_object_id": this.createdFlaeche._global_object_id,
            "flaeche": {
                "_id": this.createdFlaeche.flaeche._id
            }
        }
        const object = {
            "_objecttype": this.createdObject._objecttype,
            "_mask": this.createdObject._mask,
            "_global_object_id": this.createdObject._global_object_id,
            "flaeche": {
                "_id": this.createdObject.flaeche._id
            }
        }

        const personInstitution = []
        const descriptions = []
        const annotations = []

        // Personen / Institutionen
        if (formData.firma) {
            const firma = await this.getDanteJSKOS(formData.firma)
            const rolleAusfuehrende = await this.getDanteJSKOS("http://uri.gbv.de/terminology/nld_function/14204714-d39a-4f18-b2de-e4644646d93e")

            personInstitution.push({
                "lk_person_institution": firma,
                "lk_person_intern": null,
                "lk_rolle": rolleAusfuehrende
            })
        }
        if (formData.finder) {
            const finder = {
                "_objecttype": "personen_massnahmen",
                "_mask": "personen_massnahmen__all_fields",
                "_global_object_id": formData.finder,
                "personen_massnahmen": {
                    "_id": formData.finder.split('@')[0]
                }
            }
            const rolleFinder = await this.getDanteJSKOS("http://uri.gbv.de/terminology/nld_function/179f158c-4fa1-49c6-ba23-0b7b117f9639")

            personInstitution.push({
                "lk_person_institution": null,
                "lk_person_intern": finder,
                "lk_rolle": rolleFinder
            })
        }
        if (formData.fundmelder) {
            const fundmelder = {
                "_objecttype": "personen_massnahmen",
                "_mask": "personen_massnahmen__all_fields",
                "_global_object_id": formData.fundmelder,
                "personen_massnahmen": {
                    "_id": formData.fundmelder.split('@')[0]
                }
            }
            const rolleFundmelder = await this.getDanteJSKOS("http://uri.gbv.de/terminology/nld_function/baf841f8-2c05-4f7c-b8d8-f22f5f583f62")
            personInstitution.push({
                "lk_person_institution": null,
                "lk_person_intern": fundmelder,
                "lk_rolle": rolleFundmelder
            })


        }

        // Beschreibungen
        if (formData.fundstelleBeschreibung) {
            // TODO: Not sure if that's the correct description type => ask to make sure
            const descriptionType = await this.getDanteJSKOS("http://uri.gbv.de/terminology/nld_description_type/3000dc03-7089-45ad-8f62-170c34d3f8b8")
            descriptions.push({
                "lk_beschreibungstyp": descriptionType,
                "lk_veroeffentlichen": {
                    "_objecttype": "ja_nein_objekttyp",
                    "_mask": "ja_nein_objekttyp__all_fields",
                    "_global_object_id": "827@0437869f-aa50-498f-a0a5-a3b02be67dcc",
                    "ja_nein_objekttyp": {
                        "_id": 1
                    }
                },
                "text": formData.beschreibungDerMassnahme,
                "quelle": null,
                "verfasser": null,
                "datum": null
            })
        }
        if (formData.fundstelleBeschreibung) {
            // TODO: Not sure if that's the correct description type => ask to make sure
            const descriptionType = await this.getDanteJSKOS("http://uri.gbv.de/terminology/nld_description_type/da454480-a678-4c05-8db5-165dce88f95e")
            descriptions.push({
                "lk_beschreibungstyp": descriptionType,
                "lk_veroeffentlichen": {
                    "_objecttype": "ja_nein_objekttyp",
                    "_mask": "ja_nein_objekttyp__all_fields",
                    "_global_object_id": "827@0437869f-aa50-498f-a0a5-a3b02be67dcc",
                    "ja_nein_objekttyp": {
                        "_id": 1
                    }
                },
                "text": formData.beschreibungFunde,
                "quelle": null,
                "verfasser": null,
                "datum": null
            })
        }

        // Annotations
        if (formData.benutzer && formData.datum) {
            const annotation = await this.getAnnotationObject(
                "http://uri.gbv.de/terminology/nld_comment_type/f0583bd5-e276-4ce1-b2e4-1c8576ff3562",
                "Datensatz erstellt",
                formData.benutzer,
                formData.datum
            )
            annotations.push(annotation)
        }

        const payload = [{
            "massnahme": {
                "_pool": {
                    "pool": {
                        "_id": formData.pool.pool._id
                    }
                },
                "_id": null,
                "_version": 1,
                "_reverse_nested:massnahme__bild:lk_massnahme": [],
                "_nested:massnahme__dokumente": [],
                "_nested:massnahme__weitere_identifier": [],
                "_nested:massnahme__vorgang": [
                    {
                        "lk_einrichtung": einrichtung,
                        "jahr": formData.actionNumberForm.jahr,
                        "nummer": formData.actionNumberForm.nummer,
                        "zusatz": formData.actionNumberForm.zusatz,
                    }
                ],
                "_nested:massnahme__institutionen": [
                    institution
                ],
                "lk_massnahmenart": massnahmenart,
                "datierung": {
                    "from": formData.actionDateForm.von,
                    "to": formData.actionDateForm.bis
                },
                "lk_datierung_qualifier": datierungQualifier,
                "datierung_verbal": null,
                "lk_ursache": ursache,
                "_nested:massnahme__person_institution": personInstitution,
                "_nested:massnahme__projekt": [],
                "lk_keine_funde": null,
                "lk_keine_befunde": null,
                "_nested:massnahme__dokumentation": [],
                "_nested:massnahme__funde": [],
                "flaeche": null,
                "lk_projektion": null,
                "_nested:massnahme__politische_zugehoerigkeit": [],
                "lk_nfis_geometrie": {
                    "geometry_ids": []
                },
                "_nested:massnahme__beschreibung": descriptions,
                "_nested:massnahme__anmerkung_intern": annotations,
                "_reverse_nested:massnahme__objekt:lk_massnahme": [
                    {
                        "_pool": {
                            "pool": {
                                "_id": formData.pool.pool._id
                            }
                        },
                        "_id": null,
                        "lk_objekt": object,
                        "__idx": 0,
                        "_version": this.createdObject.object._version
                    }
                ],
                "_reverse_nested:flaeche__massnahme:lk_massnahme": [
                    {
                        "_pool": {
                            "pool": {
                                "_id": formData.pool.pool._id
                            }
                        },
                        "_id": null,
                        "lk_flaeche": flaeche,
                        "__idx": 0,
                        "_version": this.createdFlaeche.flaeche._version
                    }
                ],
                "_nested:massnahme__e_akte": [],
                "_nested:massnahme__alte_fund_ids": []
            },
            "_mask": "massnahme__all_fields",
            "_objecttype": "massnahme",
            "_idx_in_objects": 1
        }]

        const responseJson = await this.sendDataToApi(url, payload)
        this.createdAction = responseJson[0]
    }

    async sendDataToApi(url, payload) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + this.accessToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })
        this._assertResponseOk(response)
        return await response.json()
    }

    async _assertResponseOk(response, context) {
        if (response.ok) return;

        const body = await response.text().catch(() => '<unable to read response body>');
        const message = `${context} failed with status ${response.status} ${response.statusText}: ${body}`;
        console.error(`[NfisQuickEntry] ${message}`);
        throw new Error(message);
    }
}

ez5.session_ready(() => {
    ez5.rootMenu.registerApp(NfisQuickEntry);
});
window.NfisQuickEntry = NfisQuickEntry

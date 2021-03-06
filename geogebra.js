Numbas.addExtension('geogebra',['jme','math','jme-display'],function(extension) {
    window.geogebraIdAcc = window.geogebraIdAcc || 0;

    var jme = Numbas.jme;
    var sig = jme.signature;

    var delay = 10;
    var container;
	$(document).ready(function() {
        container = document.createElement('div');
        container.setAttribute('id','numbasgeogebracontainer');
        container.setAttribute('class','invisible');
        document.body.appendChild(container);
	});

    var injectedDeployScript = false;
    var loadGGB = new Promise(function(resolve,reject) {
        if(window.GGBApplet) {
            resolve(GGBApplet);
        } else {
            if(!injectedDeployScript) {
                var s = document.createElement('script');
                s.setAttribute('type','text/javascript');
                s.setAttribute('src','https://cdn.geogebra.org/apps/deployggb.js');
                document.head.appendChild(s);
                injectedDeployScript = true;
            }
            var int = setInterval(function() {
                if(window.GGBApplet) {
                    clearInterval(int);
                    resolve(GGBApplet);
                }
            },delay);
        }
    });

    var injectApplet = function(options) {
        return new Promise(function(resolve,reject) {
            var applet, el;
            options.id = 'numbasGGBApplet'+(window.geogebraIdAcc++);
            options.appletOnLoad = function() {
                var app = applet.getAppletObject();
                resolve({app:app,el:el, id:options.id});
            };
            applet = new GGBApplet(options, true);
            el = document.createElement('div');
            container.appendChild(el);
            applet.inject(el, 'preferHTML5');
        });
    }

    var constructionFinished = function(app) {
        return new Promise(function(resolve,reject) {
            var int = setInterval(function() {
                if(!app.exists) {
                    reject("app.exists does not exist");
                }
                clearInterval(int);
                resolve(app);
            },delay);
        });
    }

    extension.createGeogebraApplet = function(options) {
        var element;
        var id;
        return loadGGB
            .then(function() { return injectApplet(options)})
            .then(function(d){ element=d.el; id = d.id; return constructionFinished(d.app)})
            .then(function(app) { return new Promise(function(resolve,reject) { resolve({app:app,element:element, id: id}); }) })
        ;
    }

    function eval_replacements(replacements) {
        return function(d) {
            function unescape_braces(s) {
                return (s+'').replace(/\\\{/g,'{').replace(/\\\}/g,'}');
            }
            return new Promise(function(resolve,reject) {
                var app = d.app;
                replacements.forEach(function(r) {
                    var cmd = unescape_braces(r[0]+' = '+r[1]);
                    var ok = app.evalCommand(cmd);
                    if(!ok) {
                        // try unfixing the object - if the command succeeds this time, the object was just fixed and the command is fine
                        app.setFixed(r[0],false);
                        if(app.evalCommand(cmd)) {
                            app.setFixed(r[0],true);
                        } else {
                            reject("GeoGebra command '"+cmd+"' failed.")
                        }
                    }
                });
                // reset the undo history
                app.setBase64(app.getBase64(), function() {
                    resolve(d);
                }); 
            });
        }
    }

    /* Link GeoGebra exercises to Numbas question parts
     */
    function link_exercises_to_parts(parts) {
        return function(d) {

            return new Promise(function(resolve,reject) {
                var app = d.app;
                if(app.isExercise()) {
                    function make_marker(toolName) {
                        return function() {
                            var results = app.getExerciseResult();
                            var result = results[toolName];
                            if(!result) {
                                throw(new Numbas.Error('GeoGebra tool '+toolName+' is not defined.'));
                            }
                            this.answered = true;
                            this.setCredit(result.fraction,result.hint);
                        }
                    }

                    for(var toolName in parts) {
                        var part = parts[toolName];
                        part.mark = make_marker(toolName);
                        part.validate = function() {
                            return true;
                        }
                        part.createSuspendData = function() {
                            return {
                                base64: app.getBase64()
                            }
                        }
                    }

                    var check_timeout;
                    function check() {
                        clearTimeout(check_timeout);
                        check_timeout = setTimeout(function() {
                            for(var tool in parts) {
                                parts[tool].setDirty(true);
                            }
                        },100);
                    }
                    app.registerAddListener(check);
                    app.registerUpdateListener(check);
                    app.registerRemoveListener(check);
                    app.registerStoreUndoListener(check);
                }
                resolve(d);
            })
        }
    }

	var types = jme.types;
	var funcObj = jme.funcObj;
    var TString = types.TString;
    var TNum = types.TNum;
	var TList = types.TList;
    var THTML = types.THTML;

    function clean_material_id(material_id) {
        var m;
        if(m=material_id.match(/(?:(?:beta.)?geogebra.org\/(?:[a-zA-Z0-9]+)|ggbm.at)\/([a-zA-Z0-9]+)$/)) {
            material_id = m[1];
        }
        return material_id;
    }

    function jmeCreateGeogebraApplet(options,replacements,parts) {
        // create a container element, which we'll return
        // when the applet has been loaded, we'll attach it to the container element
        var el = document.createElement('div');
        el.className = 'numbas-geogebra-applet numbas-geogebra-loading';
        el.innerHTML = 'GeoGebra applet loading...';

        var promise = extension.createGeogebraApplet(options)
        .then(eval_replacements(replacements))
        .then(link_exercises_to_parts(parts));

        promise.then(function(d) {
            var interval = setInterval(function() {
                if(el.parentNode) {
                    el.innerHTML = '';
                    el.className = 'numbas-geogebra-applet numbas-geogebra-loaded';
                    el.appendChild(d.element);
                    clearInterval(interval);
                }
            },delay);
        })
        .catch(function(e) {
            var msg = "Problem encountered when creating GeoGebra applet: "+e;
            el.className = 'numbas-geogebra-applet numbas-geogebra-error';
            el.innerHTML = msg;
            throw(new Numbas.Error(msg));
        });

        return {element:el, promise: promise};
    }

    var unwrap = jme.unwrapValue;

    function tokToGeoGebra(tok) {
        var known_types = ['string','number','vector','list'];
        for(var i=0;i<known_types.length;i++) {
            if(jme.isType(tok,known_types[i])) {
                tok = jme.castToType(tok,known_types[i]);
                break;
            }
        }
        switch(tok.type) {
            case 'string':
                definition = tok.value;
                break;
            case 'number':
                definition = Numbas.math.niceNumber(tok.value);
                break;
            case 'vector':
                var vec = tok.value.map(Numbas.math.niceNumber);
                definition = '('+vec[0]+','+vec[1]+')';
                break;
            case 'list':
                var list = tok.value.map(tokToGeoGebra);
                definition = '{'+list.join(',') +'}';
                break;
            default:
                throw(new Error("Replaced value should be a number, string, vector or list, instead it's a "+tok.type));
        }
        return definition;
    }

    function jme_unwrap_replacements(replacements) {
        if(jme.isType(replacements,'list')) {
            return replacements.value.map(function(v) {
                if(!jme.isType(v,'list')) {
                    throw(new Error("GeoGebra replacement <code>"+jme.display.treeToJME({tok:v})+"</code> is not an array - it should be an array of the form <code>[name,definition]</code>."));
                }
                v = jme.castToType(v,'list');
                if(v.value[0].type!='string') {
                    throw(new Error("Error in replacement - first element should be the name of an object; instead it's a "+v.value[0].type));
                }
                var name = v.value[0].value;
                try {
                    var definition = tokToGeoGebra(v.value[1]);
                } catch(e) {
                    throw(new Error('Error in replacement of "'+name+'" - '+e.message));
                }
                return [name,definition];
            });
        } else if(jme.isType(replacements,'dict')) {
            return Object.keys(replacements.value).map(function(name) {
                try {
                    var definition = tokToGeoGebra(replacements.value[name]);
                } catch(e) {
                    throw(new Error('Error in replacement of "'+name+'" - '+e.message));
                }
                return [name,definition];
            });
        }
    }

    extension.scope.addFunction(new funcObj('geogebra_applet',[TString],THTML,function(material_id) {
        return new THTML(jmeCreateGeogebraApplet({material_id:clean_material_id(material_id)},[],{}).element);
    },{unwrapValues:true}));

    extension.scope.addFunction(new funcObj('geogebra_applet',[TString,sig.or(sig.type('list'),sig.type('dict'))],THTML,null,{
        evaluate: function(args,scope) {
            var material_id = unwrap(args[0]);
            try {
                var replacements = jme_unwrap_replacements(args[1]);
            } catch(e) {
                console.error(e);
                var p = document.createElement('p');
                p.innerHTML = 'Error loading GeoGebra applet: '+e.message;
                return new THTML(p);
            }
            return new THTML(jmeCreateGeogebraApplet({material_id:clean_material_id(material_id)},replacements,{}).element);
        },
        unwrapValues: true
    }));

    extension.scope.addFunction(new funcObj('geogebra_applet',[TString,sig.or(sig.type('list'),sig.type('dict')),TList],THTML,null,{
        evaluate: function(args,scope) {
            var material_id = unwrap(args[0]);
            var replacements = jme_unwrap_replacements(args[1]);
            var partrefs = args[2] ? unwrap(args[2]) : undefined;
            var question = scope.question;
            var parts = {};
            if(question) {
                partrefs.forEach(function(d) {
                    var part = parts[d[0]] = question.getPart(d[1]);
                    if(part.type != 'extension') {
                        throw(new Error("Target of a geogebra exercise must be an extension part; "+d[1]+" is of type "+part.type));
                    }
                });
            }
            var result = jmeCreateGeogebraApplet({material_id:clean_material_id(material_id)},replacements,parts);
            var first = true;
            for(var key in parts) {
                var part = parts[key];
                part.mark = function() {};
                part.validate = function() {return true;}
                var data = part.loadSuspendData();
                if(data) {
                    var base64 = data.base64;
                    if(base64) {
                        result.promise.then(function(d) {
                            d.app.setBase64(base64);
                            var p = part;
                            while(p.parentPart) {
                                p = p.parentPart;
                            }
                            p.submit();
                        });
                        break;
                    }
                }
            }

            return new THTML(result.element);
        },
        unwrapValues:true
    }));

    extension.scope.addFunction(new funcObj('geogebra_base64',[TString,TNum,TNum],THTML,function(ggbBase64,width,height) {
        var options = {
            ggbBase64: ggbBase64,
            width: width,
            height: height
        }
        return jmeCreateGeogebraApplet(options,[],[]);
    }));
});

// module_test/setup.mjs

import { expect } from 'chai';

// Mock Foundry globals
global.fromUuidSync = (uuid) => null;

global.foundry = {
  abstract: {
    TypeDataModel: class {},
    DataModel: class {}
  },
  data: {
    fields: {
      StringField: class {},
      NumberField: class {},
      BooleanField: class {},
      ArrayField: class {},
      ObjectField: class {},
      SchemaField: class {},
      EmbeddedDataField: class {},
      FilePathField: class {},
      ColorField: class {},
      HTMLField: class {},
      JSONField: class {}
    }
  },
  documents: {
    ActiveEffect: class {},
    Actor: class {
        get id() { return "test-actor-id"; }
        get uuid() { return "Actor.test-actor-id"; }
    },
    Item: class {
        get id() { return "test-item-id"; }
        get uuid() { return "Item.test-item-id"; }
    },
    TokenDocument: class {}
  },
  utils: {
    getProperty: (obj, path) => path.split('.').reduce((o, i) => o?.[i], obj),
    mergeObject: (target, source) => Object.assign(target, source),
    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
  },
  appv1: {
    sheets: {
        ActorSheet: class {},
        ItemSheet: class {}
    }
  },
  canvas: {
    placeables: {
        MeasuredTemplate: class {}
    }
  },
  applications: {
    sidebar: {
      tabs: {
        CompendiumDirectory: class {}
      }
    },
    sheets: {
        ActiveEffectConfig: class {},
        ItemSheet: class {},
        ActorSheet: class {}
    },
    hud: {
        TokenHUD: class {}
    }
  }
};

global.MeasuredTemplate = global.foundry.canvas.placeables.MeasuredTemplate;
global.TokenDocument = global.foundry.documents.TokenDocument;

global.Application = class {};

global.Hooks = {
  once: () => {},
  on: () => {},
  callAll: () => {},
  call: () => {}
};

global.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
  }
  evaluate() { return this; }
};

global.CONST = {
  ACTIVE_EFFECT_MODES: {
    CUSTOM: 0,
    MULTIPLY: 1,
    ADD: 2,
    DOWNGRADE: 3,
    UPGRADE: 4,
    OVERRIDE: 5
  }
};

global.Actor = class extends global.foundry.documents.Actor {
  constructor(data = {}) {
    super();
    this.system = data.system || {};
    this.name = data.name || "Unnamed Actor";
    this.flags = data.flags || {};
    this.effects = [];
    this.items = {
        values: () => [],
        filter: () => [],
        map: () => [],
        [Symbol.iterator]: function* () {}
    };
    this.prototypeToken = {};
    this.itemTypes = new Proxy({}, {
        get: (target, prop) => target[prop] || [],
        set: (target, prop, value) => { target[prop] = value; return true; }
    });
  }
  prepareData() {}
  get id() { return "test-actor-id"; }
  get uuid() { return "Actor.test-actor-id"; }
  getCached(key, fn) { return fn(); }
};

global.Item = class extends global.foundry.documents.Item {
  constructor(data = {}) {
    super();
    this.system = data.system || {};
    this.name = data.name || "Unnamed Item";
    this.effects = [];
    this.changes = [];
  }
  prepareData() {}
  get id() { return "test-item-id"; }
  get uuid() { return "Item.test-item-id"; }
};

global.ActiveEffect = global.foundry.documents.ActiveEffect;

global.game = {
  user: { id: "test-user", name: "Test User" },
  settings: {
    get: (scope, key) => {
        if (scope === 'swse' && key === 'defaultAttributeGenerationType') return 'Manual';
        return null;
    }
  },
  packs: {
    get: () => ({ metadata: { packageType: "world" } })
  }
};

global.CONFIG = {
  ActiveEffect: { legacyTransferral: false },
  Actor: { documentClass: global.Actor },
  Item: { documentClass: global.Item }
};

// Add other necessary globals or mocks as needed

// Foundry v13 ApplicationV2 surface. The module graph reaches these at import time, so without
// them any test that imports util.mjs or actor.mjs dies before its first assertion. Every entry
// below is a path that appears in module/, found with:
//   grep -rho "foundry.applications.[A-Za-z0-9_.]*" module/
class StubApp {}
StubApp.DEFAULT_OPTIONS = {};
StubApp.PARTS = {};
StubApp.TABS = { sheet: { tabs: [] } };

global.Handlebars = {
  registerHelper: () => {},
  registerPartial: () => {},
  compile: () => () => ""
};

global.foundry.applications.api = {
  ApplicationV2: StubApp,
  DocumentSheetV2: StubApp,
  DialogV2: class extends StubApp { static async prompt() { return null; } },
  HandlebarsApplicationMixin: (base) => base
};
global.foundry.applications.sheets.ItemSheetV2 = StubApp;
global.foundry.applications.sheets.ActorSheetV2 = StubApp;
global.foundry.applications.sheets.ActiveEffectConfig = StubApp;
global.foundry.applications.apps = {
  DocumentSheetConfig: { registerSheet: () => {} }
};
global.foundry.applications.handlebars = {
  renderTemplate: async () => "",
  getTemplate: async () => (() => ""),
  loadTemplates: async () => []
};
global.foundry.applications.ux = { ContextMenu: class {} };
global.foundry.applications.elements = {
  HTMLProseMirrorElement: { create: () => ({}) }
};

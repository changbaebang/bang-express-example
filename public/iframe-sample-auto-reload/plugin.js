(function () { var define = undefined; (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
  var CommandQueue, event, util,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  util = require('./util.coffee');

  event = require('./event.coffee');

  CommandQueue = (function() {
    CommandQueue.prototype.commands = [];

    CommandQueue.prototype.isEventListenerAttached = false;

    CommandQueue.prototype.handlers = {};

    CommandQueue.prototype.savableCommands = ["renderwidget", "renderbridge"];

    function CommandQueue(executor) {
      this.executor = executor;
    }

    CommandQueue.prototype.execute = function(params) {
      var cmd;
      cmd = Array.prototype.shift.apply(params);
      if (this.executor[cmd]) {
        this.executor[cmd].apply(this.executor, params);
      } else {
        util.debug("Unknown command: " + cmd);
      }
      util.debug("[execute] Command : " + JSON.stringify(params) + " is done.");
      return Array.prototype.unshift.call(params, cmd);
    };

    CommandQueue.prototype.push = function(params) {
      var i, item, len;
      if (util.isArray(params[0])) {
        for (i = 0, len = params.length; i < len; i++) {
          item = params[i];
          this.push(item);
        }
        return;
      }
      if (util.isIOSDevice() === true) {
        this.saveCommand(params);
      }
      return this.execute(params);
    };

    CommandQueue.prototype.saveCommand = function(params) {
      var ref;
      if (!(params[0] && (ref = params[0].toLowerCase(), indexOf.call(this.savableCommands, ref) >= 0))) {
        return;
      }
      util.debug("[saveCommand] Command : " + JSON.stringify(params) + " will be saved.");
      this.commands.push(params);
      util.debug("[saveCommand] Saved Commands : [" + this.commands.length + "] " + JSON.stringify(this.commands) + " are saved.");
      if (this.isPageShowEventHandlerReady() !== true) {
        return this.attachPageShowEventHandler();
      }
    };

    CommandQueue.prototype.isPageShowEventHandlerReady = function() {
      return this.handlers["is" + "pageshow" + "Ready"];
    };

    CommandQueue.prototype.attachHandler = function(eventName) {
      util.debug("[attachHandler] " + eventName + " handler is attached");
      this.handlers[eventName] = this[eventName + "Handler"].bind(this);
      event.addEvent(window, eventName, this.handlers[eventName]);
      return this.handlers["is" + eventName + "Ready"] = true;
    };

    CommandQueue.prototype.detachHandler = function(eventName) {
      util.debug("[detachHandler] " + eventName + " handler is dettached");
      event.removeEvent(window, "eventName", this.handlers[eventName]);
      this.handlers[eventName] = void 0;
      return this.handlers["is" + eventName + "Ready"] = false;
    };

    CommandQueue.prototype.attachPageShowEventHandler = function() {
      return this.attachHandler("pageshow");
    };

    CommandQueue.prototype.dettachPageShowEventHandler = function() {
      return this.detachHandler("pageshow");
    };

    CommandQueue.prototype.attachRebuildEventHandler = function() {
      return this.attachHandler("rebuild");
    };

    CommandQueue.prototype.dettachRebuildEventHandler = function() {
      return this.detachHandler("rebuild");
    };

    CommandQueue.prototype.pageshowHandler = function(e) {
      util.debug("[pageshowHandler] event " + e.persisted + " / " + JSON.stringify(e));
      if (e.persisted !== true) {
        return;
      }
      util.debug("[pageshowHandler] history move is called");
      this.dettachPageShowEventHandler();
      this.attachRebuildEventHandler();
      return event.postEvent(document, "rebuild");
    };

    CommandQueue.prototype.rebuildHandler = function() {
      var command, i, len, tempCommands;
      util.debug("[rebuildHandler] rebuild event is posted with " + JSON.stringify(this.commands));
      this.dettachRebuildEventHandler();
      tempCommands = this.commands;
      this.commands = [];
      util.debug("[rebuildCommandHandler] Saved Command : [" + this.commands.length + "] " + JSON.stringify(this.commands) + " will be saved.");
      util.debug("[rebuildCommandHandler] Required Command : [" + tempCommands.length + "] " + JSON.stringify(tempCommands) + " will be sapushed.");
      for (i = 0, len = tempCommands.length; i < len; i++) {
        command = tempCommands[i];
        this.push(command);
      }
      return util.debug("[rebuildCommandHandler] Saved Command : [" + this.commands.length + "] " + JSON.stringify(this.commands) + " will be saved.");
    };

    return CommandQueue;

  })();

  module.exports = CommandQueue;


  },{"./event.coffee":12,"./util.coffee":22}],2:[function(require,module,exports){
  var Executor, JSONP, Widget, ad, bridgeManager, cmsWidget, cookie, crc32, logger, mall, meta, pubsub, qterm, scrollManager, util,
    slice = [].slice;

  Widget = require('./widget.coffee');

  JSONP = require('./JSONP.coffee');

  cookie = require('./cookie.coffee');

  pubsub = require('./pubsub.coffee');

  util = require('./util.coffee');

  mall = require('./mall.coffee');

  qterm = require('./qterm.coffee');

  crc32 = require('./crc32.js');

  meta = require('./meta.coffee');

  ad = require('./ad.coffee');

  logger = require('./logger.coffee');

  scrollManager = require('./scroll-manager.coffee');

  bridgeManager = require('./bridge-manager.coffee');

  cmsWidget = require('./cms-widget.coffee');

  Executor = (function() {
    var cache_cookie_name, cache_expire, get_cookie_param, is_dup_checksum, log_checksum, referrer;

    function Executor() {}

    cache_cookie_name = 'dable_uid';

    cache_expire = 2 * 365 * 24 * 60 * 60 * 1000;

    referrer = (typeof window !== "undefined" && window !== null ? window.TEST_REFERRER : void 0) || util.getReferrer();

    log_checksum = function(params) {
      var checksum, cookie_name, expire;
      checksum = crc32(params);
      cookie_name = '__rpksum';
      expire = 600000;
      return cookie.set_cookie(cookie_name, checksum, expire);
    };

    is_dup_checksum = function(params) {
      var checksum, cookie_name;
      cookie_name = '__rpksum';
      checksum = crc32(params);
      return cookie.check_cookie(cookie_name) === checksum;
    };

    get_cookie_param = function() {
      var cached_cookie, param, param_uid, ref, ref1, ref2;
      cached_cookie = cookie.check_cookie(cache_cookie_name);
      param_uid = typeof window !== "undefined" && window !== null ? (ref = window.location) != null ? (ref1 = ref.href) != null ? (ref2 = ref1.match(/[\?\&]dable_uid=([^\#\&]+)/)) != null ? ref2[1] : void 0 : void 0 : void 0 : void 0;
      param = {
        cached_uid: ""
      };
      if (param_uid) {
        param.cached_uid = param_uid;
      } else if (cached_cookie && cached_cookie !== 'undefined') {
        param.cached_uid = cached_cookie;
      }
      return param;
    };

    Executor.prototype.fetchPrefs = function(cb) {
      var arg_, param;
      if (this.prefs) {
        return cb(this.prefs);
      }
      arg_ = arguments;
      if (!this.service_name) {
        return setTimeout(((function(_this) {
          return function() {
            return _this.fetchPrefs.apply(_this, arg_);
          };
        })(this)), 100);
      }
      if (this.fetch_prefs_queue) {
        this.fetch_prefs_queue.push(cb);
        return;
      }
      this.fetch_prefs_queue = [cb];
      param = get_cookie_param();
      if (this.cid) {
        param.cid = this.cid;
      }
      JSONP.get(((util.protocol()) + "//" + (util.api_server_domain())) + ("/plugin/services/" + (encodeURIComponent(this.service_name)) + "/prefs2"), param, (function(_this) {
        return function(data) {
          var i, len, q, ref, ref1, ref2, ref3, ref4;
          _this.prefs = data && data.result || null;
          ref = _this.fetch_prefs_queue;
          for (i = 0, len = ref.length; i < len; i++) {
            q = ref[i];
            q(_this.prefs);
          }
          _this.fetch_prefs_queue = null;
          cookie.set_cookie(cache_cookie_name, _this.prefs.cid, cache_expire);
          if ((ref1 = _this.prefs) != null ? (ref2 = ref1.service) != null ? ref2.custom_script_url : void 0 : void 0) {
            util.includeScript((ref3 = _this.prefs) != null ? (ref4 = ref3.service) != null ? ref4.custom_script_url : void 0 : void 0);
          }
        };
      })(this));
    };

    Executor.prototype.setHttpsOnly = function() {
      return util.set_protocol('https:');
    };

    Executor.prototype.setScrollBaseElement = function(el) {
      return util.set_scroll_base_el(el);
    };

    Executor.prototype.fetchUID = function(callback) {
      var create_tmp_uid;
      create_tmp_uid = function() {
        var val;
        val = String(Math.round(Math.random() * 90000000) + 10000000) + ".";
        val += String((new Date).getTime());
        return val;
      };
      if (this.uid) {
        return callback(this.uid);
      }
      return this.fetchPrefs(function(prefs) {
        var cid;
        cid = prefs.cid;
        return callback(cid || create_tmp_uid());
      });
    };

    Executor.prototype.fetchUserGroup = function(callback) {
      return this.fetchUID((function(_this) {
        return function(uid) {
          return callback(Math.floor(uid % 10) || null);
        };
      })(this));
    };

    Executor.prototype.sendLog = function() {
      var _article_body_elem, _meta, _read_log_sended, _start_time, action_type, arg_, args, checkAndSendReadLog, i, item, items, len, next, payload, read_items, sendReadLog, wait_for_item;
      action_type = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if (action_type == null) {
        action_type = "";
      }
      arg_ = arguments;
      if (!this.service_name) {
        return setTimeout(((function(_this) {
          return function() {
            return _this.sendLog.apply(_this, arg_);
          };
        })(this)), 100);
      }
      read_items = function(arr) {
        var i, item, items, len, ref;
        items = [];
        for (i = 0, len = arr.length; i < len; i++) {
          item = arr[i];
          if (util.isArray(item)) {
            Array.prototype.push.apply(items, read_items(item));
          } else if (item) {
            if ((ref = typeof item) === "number" || ref === "string") {
              item = {
                id: item
              };
            }
            if (!item.id) {
              continue;
            }
            if (meta.is_hidden(action_type)) {
              item.is_hidden = 1;
            }
            items.push(item);
          }
        }
        return items;
      };
      _start_time = null;
      _read_log_sended = false;
      _article_body_elem = null;
      sendReadLog = function(payload) {
        var _payload, ref;
        if (_read_log_sended) {
          return;
        }
        _read_log_sended = true;
        _payload = util.clone(payload);
        _payload.action = 'read';
        _payload.sess_dur_sec = Math.floor((new Date() - _start_time) / 1000);
        _payload.body_height = Math.floor(util.getElemHeight(_article_body_elem));
        _payload.body_length = (ref = meta.read_body()) != null ? ref.length : void 0;
        return logger.sendActionLog(_payload);
      };
      checkAndSendReadLog = function(payload) {
        _article_body_elem = meta.read_body_el();
        if (!_article_body_elem) {
          return;
        }
        _start_time = new Date();
        if ((typeof document !== "undefined" && document !== null ? document.readyState : void 0) === 'complete') {
          return scrollManager.listenByElement({
            targetElement: _article_body_elem,
            method: function() {
              return sendReadLog(payload);
            },
            offsetY: Math.max(util.getElemHeight(_article_body_elem) - 300, 300),
            reregisterIntervalMs: 5000 + parseInt(Math.random() * 500, 10)
          });
        } else {
          return setTimeout(function() {
            return checkAndSendReadLog(payload);
          }, 1000);
        }
      };
      payload = {
        site: this.service_name,
        url: this.url || window.location.href,
        ref: this.ref || referrer
      };
      if (this.mid != null) {
        payload.mid = this.mid;
      }
      if (this.gender != null) {
        payload.gender = this.gender;
      }
      if (this.birthyear != null) {
        payload.birthyear = this.birthyear;
      }
      payload.action = action_type;
      if (this.payload_c) {
        payload.c = this.payload_c;
      }
      payload.lang = util.getFullUserLanguage();
      next = (function(_this) {
        return function() {
          return qterm.fetch(referrer, function(term) {
            if (term) {
              payload.q = encodeURIComponent(term);
              pubsub.publish('qterm', payload.q);
            }
            return _this.fetchPrefs(function(prefs) {
              return _this.fetchUID(function(uid) {
                payload.uid = uid;
                payload.cid = prefs.cid;
                payload.service = prefs.service;
                payload.sp_client = prefs.sp_client;
                payload.payco_log_url = prefs.payco_log_url;
                payload.kakao_log_url = prefs.kakao_log_url;
                payload.adx_log_url = prefs.adx_log_url;
                if (!payload.service) {
                  util.debug("Unknown SERVICE: " + _this.service_name);
                  return;
                }
                return logger.sendActionLog(payload, function() {
                  if (payload.action === 'view') {
                    checkAndSendReadLog(payload);
                    return meta.update_item(_this.service_name, payload.items, {
                      is_update_article_body: prefs.service.collect_article_body_on_client === true
                    });
                  }
                });
              });
            });
          });
        };
      })(this);
      items = [];
      if (action_type === 'like' || action_type === 'view' || action_type === 'cart' || action_type === 'buy') {
        items = read_items(args);
        if (items.length > 0) {
          pubsub.publish('item_ids', (function() {
            var i, len, results;
            results = [];
            for (i = 0, len = items.length; i < len; i++) {
              item = items[i];
              results.push(item.id);
            }
            return results;
          })());
        }
      }
      switch (action_type) {
        case "view":
          for (i = 0, len = items.length; i < len; i++) {
            item = items[i];
            _meta = meta.read_item();
            if (!item.c1 && _meta.category1) {
              item.c1 = _meta.category1;
            }
            if (!item.c2 && _meta.category2) {
              item.c2 = _meta.category2;
            }
            if (!item.c3 && _meta.category3) {
              item.c3 = _meta.category3;
            }
            if (!item.comment_count && _meta.comment_count) {
              item.comment_count = _meta.comment_count;
            }
            if (_meta.url) {
              item.link = _meta.url;
            } else if (this.url) {
              item.link = this.url;
            }
          }
          payload.items = items;
          if (items.length === 0) {
            payload.action = 'visit';
          }
          next();
          break;
        case "like":
          payload.items = items;
          if (items.length === 0) {
            payload.action = 'visit';
          }
          next();
          break;
        case "cart":
          payload.items = items;
          next();
          break;
        case "buy":
          payload.items = items;
          if (items.length === 0) {
            mall.prepare((function(_this) {
              return function() {
                return mall.auto.fetchBuyEndIds(function(item_ids) {
                  payload.items = item_ids;
                  return next();
                });
              };
            })(this));
          } else {
            _meta = meta.read_item();
            if (items[0].id === _meta.item_id) {
              if (!items[0].c1 && _meta.category1) {
                items[0].c1 = _meta.category1;
              }
              if (!items[0].c2 && _meta.category2) {
                items[0].c2 = _meta.category2;
              }
              if (!items[0].c3 && _meta.category3) {
                items[0].c3 = _meta.category3;
              }
            }
            next();
          }
          break;
        case "search":
          payload.q = encodeURIComponent(args[0]);
          pubsub.publish('qterm', payload.q);
          if (!payload.q) {
            payload.action = 'visit';
          }
          next();
          break;
        case "visit":
          payload.action = 'visit';
          next();
          break;
        default:
          wait_for_item = function(cb, times) {
            var _item;
            if (times == null) {
              times = 0;
            }
            _item = meta.read_item();
            if (_item != null ? _item.item_id : void 0) {
              return cb(_item);
            } else if (times > 3) {
              return cb(null);
            } else {
              return setTimeout((function() {
                return wait_for_item(cb, times + 1);
              }), 100);
            }
          };
          wait_for_item(function(_item) {
            if (_item != null ? _item.item_id : void 0) {
              payload.action = "view";
              item = {
                id: _item.item_id
              };
              pubsub.publish('item_ids', [item.id]);
              if (!item.c1 && (_item != null ? _item.category1 : void 0)) {
                item.c1 = _item.category1;
              }
              if (!item.c2 && (_item != null ? _item.category2 : void 0)) {
                item.c2 = _item.category2;
              }
              if (!item.c3 && (_item != null ? _item.category3 : void 0)) {
                item.c3 = _item.category3;
              }
              if (!item.comment_count && _item.comment_count) {
                item.comment_count = _item.comment_count;
              }
              if (_item != null ? _item.url : void 0) {
                item.link = _item.url;
              }
              payload.items = [item];
            } else {
              payload.action = 'visit';
            }
            return next();
          });
      }
      this.action_type = action_type || 'auto';
      return this.items = items;
    };

    Executor.prototype.sendLogOnce = function(action_type) {
      var arg_;
      if (!this._log_sended) {
        this._log_sended = {};
      }
      if (this._log_sended[action_type || "auto"] === 1) {
        return;
      }
      this._log_sended[action_type || "auto"] = 1;
      arg_ = arguments;
      return this.sendLog.apply(this, arg_);
    };

    Executor.prototype.sendMallLog = function(mall_type, ignore_run_once_check) {
      if (ignore_run_once_check == null) {
        ignore_run_once_check = false;
      }
      if (this.run_once_checked && !ignore_run_once_check) {
        return;
      }
      this.run_once_checked = true;
      mall.prepare((function(_this) {
        return function() {
          var handler;
          handler = mall[mall_type];
          if (handler.isView()) {
            return handler.fetchItemIdViewPage(function(item_id) {
              log_checksum([item_id]);
              _this.sendLog('view', item_id);
              return true;
            });
          }
          if (handler.isCart()) {
            return handler.fetchCartIds(function(item_ids) {
              var params;
              params = item_ids || [];
              params.unshift("cart");
              log_checksum(params);
              _this.sendLog.apply(_this, params);
              return true;
            });
          }
          if (handler.isBuyEnd()) {
            return handler.fetchBuyEndIds(function(item_ids) {
              var isDupLog, params;
              params = item_ids || [];
              params.unshift("buy");
              isDupLog = is_dup_checksum(params);
              log_checksum(params);
              if (isDupLog) {
                return true;
              }
              _this.sendLog.apply(_this, params);
              return true;
            });
          }
          if (handler.isSearch()) {
            return handler.fetchSearchTerm(function(term) {
              _this.sendLog('search', term);
              return true;
            });
          }
          return _this.sendLog();
        };
      })(this));
      return true;
    };

    Executor.prototype.setService = function(service_name) {
      if (!service_name || typeof service_name !== "string") {
        return util.debug("Unknown SERVICE: " + service_name);
      }
      if (service_name.substr(service_name.length - 1, 1) === '/') {
        service_name = service_name.substr(0, service_name.length - 1);
      }
      this.service_name = service_name.toLowerCase();
      pubsub.publish('service_name', this.service_name);
    };

    Executor.prototype.setServiceByWidth = function(pc_service_name, mo_service_name) {
      if (pc_service_name && mo_service_name === void 0) {
        return util.debug("setServiceByWidth requires two service names");
      }
      if (util.isMobileView()) {
        return this.setService(mo_service_name);
      } else {
        return this.setService(pc_service_name);
      }
    };

    Executor.prototype.service = Executor.prototype.setService;

    Executor.prototype.fetchService = function(cb) {
      return cb(this.service_name);
    };

    Executor.prototype.c = function(payload_c) {
      this.payload_c = payload_c;
    };

    Executor.prototype.setCID = function(cid1) {
      this.cid = cid1;
      return this.fetchPrefs(function() {});
    };

    Executor.prototype.setUID = function(uid) {
      if (uid != null) {
        return this.uid = uid;
      }
    };

    Executor.prototype.setMID = function(mid) {
      this.mid = mid;
    };

    Executor.prototype.setURL = function(url) {
      this.url = url;
    };

    Executor.prototype.setRef = function(ref) {
      this.ref = ref;
    };

    Executor.prototype.setGender = function(gender) {
      return this.setUserInfo({
        gender: gender
      });
    };

    Executor.prototype.setBirthYear = function(birthyear) {
      return this.setUserInfo({
        birthyear: birthyear
      });
    };

    Executor.prototype.setUserInfo = function(info) {
      var g, y;
      if (!info) {
        return;
      }
      if (typeof arguments[0] === "string" && arguments[1]) {
        info = {};
        info[arguments[0]] = arguments[1];
      }
      if (info.mid) {
        this.mid = info.mid;
      }
      if (info.uid) {
        this.uid = info.uid;
      }
      if (info.gender) {
        g = info.gender.toUpperCase();
        if (g !== 'M' && g !== 'F' && g !== 'O') {
          util.debug("Invalid gender: " + info.gender);
        } else {
          this.gender = info.gender;
        }
      }
      if (info.birthyear) {
        y = parseInt(info.birthyear);
        if (y < 1900 || y > new Date().getFullYear()) {
          return util.debug("Invalid birthyear: " + y);
        } else {
          return this.birthyear = y;
        }
      }
    };

    Executor.prototype.renderWidget = function() {
      var callback, cookie_param, dom_id, dom_id_or_el, el, ignore_items, item_ids, next, others, user_options;
      dom_id_or_el = arguments[0], item_ids = arguments[1], others = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      if (!dom_id_or_el) {
        return util.debug("dom id or element should be provided");
      } else if (typeof dom_id_or_el !== "string") {
        el = dom_id_or_el;
        if (el.id) {
          dom_id = el.id;
        } else {
          dom_id = "_dblwdgt_" + (Math.floor(Math.random() * 99999999));
          el.id = dom_id;
        }
      } else {
        dom_id = dom_id_or_el;
      }
      if (typeof (others != null ? others[0] : void 0) === "function") {
        callback = others[0];
      } else if (typeof (others != null ? others[1] : void 0) === "function") {
        callback = others[1];
      } else {
        callback = null;
      }
      if (typeof (others != null ? others[0] : void 0) === "object") {
        user_options = others[0];
      } else {
        user_options = {};
      }
      if ((item_ids != null ? item_ids.ignore_items : void 0) || (item_ids != null ? item_ids.ignoreItems : void 0)) {
        user_options = item_ids || {};
        item_ids = null;
      }
      ignore_items = (user_options != null ? user_options.ignore_items : void 0) || (user_options != null ? user_options.ignoreItems : void 0);
      next = (function(_this) {
        return function(opts, retry) {
          var _item, cid, item, uid;
          if (retry == null) {
            retry = 30;
          }
          cid = opts.cid, uid = opts.uid;
          if (!item_ids && retry > 0 && !ignore_items) {
            if (!_this.action_type) {
              setTimeout((function() {
                return next(opts, retry - 1);
              }), 100);
              return;
            } else {
              item_ids = (function() {
                var i, len, ref, results;
                ref = this.items;
                results = [];
                for (i = 0, len = ref.length; i < len; i++) {
                  item = ref[i];
                  results.push(item.id);
                }
                return results;
              }).call(_this);
              if (item_ids.length === 0) {
                _item = meta.read_item();
                if (_item != null ? _item.item_id : void 0) {
                  item_ids = [_item.item_id];
                } else {
                  item_ids = null;
                }
              }
            }
          }
          if (_this.service_name) {
            user_options.service_name = _this.service_name;
          }
          if (_this.url) {
            user_options.url = _this.url;
          }
          if (_this.ref) {
            user_options.ref = _this.ref;
          }
          return new Widget(dom_id, cid, uid, item_ids, user_options, callback);
        };
      })(this);
      cookie_param = get_cookie_param();
      if (this.uid || cookie_param.cached_uid) {
        next({
          cid: this.cid || cookie_param.cached_uid,
          uid: this.uid || cookie_param.cached_uid
        });
        return this.fetchPrefs((function(_this) {
          return function() {};
        })(this));
      } else {
        return this.fetchPrefs((function(_this) {
          return function(prefs) {
            return _this.fetchUID(function(uid) {
              return next({
                cid: prefs.cid,
                uid: uid
              });
            });
          };
        })(this));
      }
    };

    Executor.prototype.renderWidgetByWidth = function() {
      var device, dom_id_or_el, el, item_ids, others, widget_id;
      dom_id_or_el = arguments[0], item_ids = arguments[1], others = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      if (!dom_id_or_el) {
        return util.debug("renderWidgetByWidth needs target dom or dom_id");
      } else if (typeof dom_id_or_el === 'string') {
        el = document.getElementById(dom_id_or_el);
      } else if (typeof dom_id_or_el === 'object') {
        el = dom_id_or_el;
      } else {
        return util.debug("renderWidgetByWidth got unexpected parameter : " + dom_id_or_el);
      }
      if (el) {
        device = util.isMobileView() ? 'mo' : 'pc';
        widget_id = el.getAttribute("data-widget_id-" + device);
        if (!widget_id) {
          return util.debug("no data-widget_id-" + device + " in dom : " + dom_id_or_el);
        }
        el.setAttribute("data-widget_id", widget_id);
        return this.renderWidget.apply(this, [el, item_ids].concat(slice.call(others)));
      } else {
        return util.debug("renderWidgetByWidth found no DOM from given target : " + dom_id_or_el);
      }
    };

    Executor.prototype.renderBridge = function() {
      var _renderBridgeWidget, callback, dom_id_or_el, item_id, item_ids, others, user_options;
      dom_id_or_el = arguments[0], item_ids = arguments[1], others = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      if (typeof (others != null ? others[0] : void 0) === "function") {
        callback = others[0];
      } else if (typeof (others != null ? others[1] : void 0) === "function") {
        callback = others[1];
      } else {
        callback = null;
      }
      if (typeof (others != null ? others[0] : void 0) === "object") {
        user_options = others[0];
      } else {
        user_options = {};
      }
      _renderBridgeWidget = (function(_this) {
        return function(item_id) {
          window.scroll(0, 0);
          user_options.is_bridge = 1;
          user_options.bridge_item_id = item_id;
          return _this.renderWidget(dom_id_or_el, item_ids, user_options, callback);
        };
      })(this);
      bridgeManager.init({
        dom_id_or_el: dom_id_or_el,
        onItemChange: _renderBridgeWidget
      });
      item_id = bridgeManager.getItemIdFromHashTag();
      return _renderBridgeWidget(item_id);
    };

    Executor.prototype.setCookieDoc = function(d) {
      return window.COOKIE_DOCUMENT = d;
    };

    Executor.prototype.widget = Executor.prototype.renderWidget;

    Executor.prototype.initCmsWidget = function(id, content_el_id) {
      return cmsWidget.init(id, content_el_id, this.renderWidget.bind(this));
    };

    Executor.prototype.initAd = function(ad_id) {
      var arg_;
      arg_ = arguments;
      if (!this.service_name) {
        return setTimeout(((function(_this) {
          return function() {
            return _this.initAd.apply(_this, arg_);
          };
        })(this)), 100);
      }
      return this.fetchPrefs((function(_this) {
        return function(prefs) {
          return _this.fetchUID(function(uid) {
            var ref;
            return ad.init({
              service_name: _this.service_name,
              cid: prefs.cid,
              uid: uid,
              ad_id: ad_id,
              service_id: prefs != null ? (ref = prefs.service) != null ? ref.service_id : void 0 : void 0
            });
          });
        };
      })(this));
    };

    return Executor;

  })();

  module.exports = Executor;


  },{"./JSONP.coffee":4,"./ad.coffee":5,"./bridge-manager.coffee":9,"./cms-widget.coffee":10,"./cookie.coffee":11,"./crc32.js":31,"./logger.coffee":14,"./mall.coffee":16,"./meta.coffee":17,"./pubsub.coffee":18,"./qterm.coffee":19,"./scroll-manager.coffee":20,"./util.coffee":22,"./widget.coffee":23}],3:[function(require,module,exports){
  var JSON = (this && this.JSON) || function () {

    function f(n) {    // Format integers to have at least two digits.
      return n < 10 ? '0' + n : n;
    }

    Date.prototype.toJSON = function () {
      return this.getUTCFullYear()   + '-' +
        f(this.getUTCMonth() + 1) + '-' +
        f(this.getUTCDate())      + 'T' +
        f(this.getUTCHours())     + ':' +
        f(this.getUTCMinutes())   + ':' +
        f(this.getUTCSeconds())   + 'Z';
    };


    var m = {    // table of character substitutions
      '\b': '\\b',
      '\t': '\\t',
      '\n': '\\n',
      '\f': '\\f',
      '\r': '\\r',
      '"' : '\\"',
      '\\': '\\\\'
    };

    function stringify(value, whitelist) {
      var a,          // The array holding the partial texts.
      i,          // The loop counter.
      k,          // The member key.
      l,          // Length.
      r = /["\\\x00-\x1f\x7f-\x9f]/g,
      v;          // The member value.

      switch (typeof value) {
        case 'string':

          return r.test(value) ?
          '"' + value.replace(r, function (a) {
            var c = m[a];
            if (c) {
              return c;
            }
            c = a.charCodeAt();
            return '\\u00' + Math.floor(c / 16).toString(16) +
              (c % 16).toString(16);
          }) + '"' :
          '"' + value + '"';

        case 'number':

          return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':
          return String(value);

        case 'object':

          if (!value) {
            return 'null';
          }

          if (typeof value.toJSON === 'function') {
            return stringify(value.toJSON());
          }
          a = [];
          if (typeof value.length === 'number' &&
            !(value.propertyIsEnumerable('length'))) {

              l = value.length;
              for (i = 0; i < l; i += 1) {
                a.push(stringify(value[i], whitelist) || 'null');
              }

              return '[' + a.join(',') + ']';
            }
            if (whitelist) {
              l = whitelist.length;
              for (i = 0; i < l; i += 1) {
                k = whitelist[i];
                if (typeof k === 'string') {
                  v = stringify(value[k], whitelist);
                  if (v) {
                    a.push(stringify(k) + ':' + v);
                  }
                }
              }
            } else {

              for (k in value) {
                if (typeof k === 'string') {
                  v = stringify(value[k], whitelist);
                  if (v) {
                    a.push(stringify(k) + ':' + v);
                  }
                }
              }
            }

            return '{' + a.join(',') + '}';
      }
    }

    return {
      stringify: stringify,
      parse: function (text, filter) {
        var j;

        function walk(k, v) {
          var i, n;
          if (v && typeof v === 'object') {
            for (i in v) {
              if (Object.prototype.hasOwnProperty.apply(v, [i])) {
                n = walk(i, v[i]);
                if (n !== undefined) {
                  v[i] = n;
                } else {
                  delete v[i];
                }
              }
            }
          }
          return filter(k, v);
        }
        if (/^[\],:{}\s]*$/.test(text.replace(/\\["\\\/bfnrtu]/g, '@').
        replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
        replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

          j = eval('(' + text + ')');

          return typeof filter === 'function' ? walk('', j) : j;
        }

        throw new SyntaxError('parseJSON');
      }
    };
  }();

  module.exports = JSON;
  if (window && window.dable) window.dable.JSON = JSON;

  },{}],4:[function(require,module,exports){
  var JSONP, ref;

  JSONP = (ref = typeof window !== "undefined" && window !== null ? window.TEST_JSONP : void 0) != null ? ref : (function() {
    var counter, isArray, jsonp, load, paramToString;
    counter = 0;
    isArray = function(obj) {
      return Object.prototype.toString.call(obj) === "[object Array]";
    };
    load = function(url) {
      var done, head, script;
      script = document.createElement('script');
      head = document.getElementsByTagName('head')[0];
      done = false;
      script.src = url;
      script.async = true;
      script.onload = script.onreadystatechange = function() {
        if (!done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete")) {
          done = true;
          script.onload = script.onreadystatechange = null;
          if (script && script.parentNode) {
            return script.parentNode.removeChild(script);
          }
        }
      };
      return head.appendChild(script);
    };
    paramToString = function(key, val) {
      var i, j, key2, len, s, str, val2;
      s = [];
      if (isArray(val)) {
        for (i = j = 0, len = val.length; j < len; i = ++j) {
          val2 = val[i];
          str = paramToString(key + "[" + i + "]", val2);
          if (str) {
            s.push(str);
          }
        }
      } else if (typeof val === "object") {
        for (key2 in val) {
          val2 = val[key2];
          str = paramToString(key + "[" + key2 + "]", val2);
          if (str) {
            s.push(str);
          }
        }
      } else if (key) {
        s.push(encodeURIComponent(key) + "=" + encodeURIComponent(val));
      }
      return s.join("&");
    };
    jsonp = function(url, params, callback) {
      var jsonp_cb, key, query, str;
      query = "?";
      params = params || {};
      for (key in params) {
        if (params.hasOwnProperty(key)) {
          str = paramToString(key, params[key]);
          if (str) {
            query += str + "&";
          }
        }
      }
      jsonp_cb = "dbljson" + (++counter);
      if (typeof window !== "undefined" && window !== null) {
        window[jsonp_cb] = function(data) {
          var e;
          if (callback) {
            callback(data);
          }
          try {

          } catch (error) {
            e = error;
          }
        };
      }
      load(url + query + "callback=" + jsonp_cb);
      return jsonp_cb;
    };
    return {
      get: jsonp
    };
  })();

  module.exports = JSONP;


  },{}],5:[function(require,module,exports){
  var JSONP, decodeHtml, ga, init, legacyAd, platformAd, readElements, renderAd, sendViewNsLog, util;

  JSONP = require('./JSONP.coffee');

  util = require('./util.coffee');

  ga = require('./ga.coffee');

  readElements = function() {
    var divEls, el, i, j, len, len1, p, result, spanEls;
    result = {
      body: null,
      head: null
    };
    divEls = document.getElementsByTagName("div");
    spanEls = document.getElementsByTagName("span");
    for (i = 0, len = divEls.length; i < len; i++) {
      el = divEls[i];
      p = el.getAttribute("itemprop");
      if (p === "articleBody") {
        result.body = el;
      } else if (p === "headline") {
        result.head = el;
      }
    }
    for (j = 0, len1 = spanEls.length; j < len1; j++) {
      el = spanEls[j];
      p = el.getAttribute("itemprop");
      if (p === "articleBody") {
        result.body = el;
      } else if (p === "headline") {
        result.head = el;
      }
    }
    if (!result.body || !result.head) {
      return null;
    }
    return result;
  };

  decodeHtml = function(html) {
    var txt;
    txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  legacyAd = {
    read: function(service_name, uid, ad_id, service_id, callback) {
      var url;
      url = (util.protocol()) + "//" + (util.api_server_domain()) + "/inlink_ads";
      url += "/services/" + (encodeURIComponent(service_name));
      url += "/users/" + (encodeURIComponent(uid)) + "/" + ad_id;
      return JSONP.get(url, {}, function(data) {
        var ref, ref1;
        if (data != null) {
          if ((ref = data.result) != null) {
            ref.data.service_id = service_id;
          }
        }
        return callback(data != null ? (ref1 = data.result) != null ? ref1.data : void 0 : void 0);
      });
    }
  };

  renderAd = function(elements, data) {
    document.title = data.title;
    elements.head.innerHTML = data.article_head;
    elements.body.innerHTML = util.stripAndExecuteScript(data.article_body);
    return ga.sendForAd({
      campaign_id: data.campaign_id,
      content_id: data.content_id,
      service_id: data.service_id
    });
  };

  platformAd = {
    read: function(opts, callback) {
      var ad_url, campaign_id, channel, cid, content_id, method, service_id, service_name, uid;
      service_name = opts.service_name, cid = opts.cid, uid = opts.uid, campaign_id = opts.campaign_id, content_id = opts.content_id, method = opts.method, channel = opts.channel, service_id = opts.service_id;
      ad_url = (util.protocol()) + "//sp-api.dable.io";
      ad_url += "/services/" + (encodeURIComponent(service_name));
      ad_url += "/users/" + (encodeURIComponent(uid));
      ad_url += "/campaigns/" + (encodeURIComponent(campaign_id));
      ad_url += "/contents/" + (encodeURIComponent(content_id));
      return JSONP.get(ad_url, {
        from: window.location.href,
        cid: cid,
        method: method,
        channel: channel
      }, function(data) {
        var result;
        result = (data != null ? data.result : void 0) || {};
        result.service_name = service_name;
        result.service_id = service_id;
        return callback(result);
      });
    }
  };

  sendViewNsLog = function(duration, opts) {
    var ad_id, campaign_id, channel, cid, content_id, e, logUrl, method, ref, service_name, uid;
    if (location.href.indexOf('/preview') > -1) {
      return;
    }
    service_name = opts.service_name, uid = opts.uid, ad_id = opts.ad_id, cid = opts.cid, method = opts.method, channel = opts.channel;
    ref = ad_id.split('-'), campaign_id = ref[0], content_id = ref[1];
    e = encodeURIComponent;
    logUrl = ((util.protocol()) + "//sp-api.dable.io/services/" + (e(service_name))) + ("/users/" + (e(uid)) + "/campaigns/" + (e(campaign_id))) + ("/contents/" + (e(content_id)) + "/inlinkview" + duration + "s");
    return JSONP.get(logUrl, {
      cid: cid,
      method: method,
      channel: channel
    }, function() {});
  };

  init = function(opts) {
    var ad_id, campaign_id, cid, content_id, elements, ref, service_id, service_name, uid;
    service_name = opts.service_name, uid = opts.uid, ad_id = opts.ad_id, cid = opts.cid, service_id = opts.service_id;
    elements = readElements();
    if (!elements) {
      return setTimeout((function() {
        return init(opts);
      }), 300);
    }
    if (!ad_id) {
      opts.ad_id = ad_id = util.readParam('dablead');
    }
    opts.method = util.readParam('method');
    opts.channel = util.readParam('channel');
    if (ad_id.indexOf('-') > -1) {
      ref = ad_id.split('-'), campaign_id = ref[0], content_id = ref[1];
      if (campaign_id && content_id) {
        return platformAd.read({
          service_name: service_name,
          cid: cid,
          uid: uid,
          campaign_id: campaign_id,
          content_id: content_id,
          method: opts.method,
          channel: opts.channel,
          service_id: service_id
        }, function(data) {
          renderAd(elements, data);
          if (data.dablena) {
            setTimeout(function() {
              return sendViewNsLog(5, opts);
            }, 5000);
            return setTimeout(function() {
              return sendViewNsLog(30, opts);
            }, 30000);
          }
        });
      }
    } else {
      return legacyAd.read(service_name, uid, ad_id, service_id, function(data) {
        return renderAd(elements, data);
      });
    }
  };

  module.exports = {
    init: init
  };


  },{"./JSONP.coffee":4,"./ga.coffee":13,"./util.coffee":22}],6:[function(require,module,exports){
  var adult_words, isAdultContent, meta;

  meta = require('./meta.coffee');

  adult_words = ['맨다리', '포르노', '성교', '섹스', '야동', '처제', '19금', '젖꼭지', '몰카', '천일야화', '호모토피아', '창녀', '정사신', '누드', '콘돔'];

  isAdultContent = function() {
    var d, i, len, t, w;
    t = meta.get_meta_value('og:title');
    d = meta.get_meta_value('og:description');
    for (i = 0, len = adult_words.length; i < len; i++) {
      w = adult_words[i];
      if (t.indexOf(w) > -1 || d.indexOf(w) > -1) {
        return true;
      }
    }
    return false;
  };

  module.exports = {
    isAdultContent: isAdultContent
  };


  },{"./meta.coffee":17}],7:[function(require,module,exports){
  var JSON, createCORSRequest, post, util;

  JSON = require('./JSON');

  util = require('./util.coffee');

  createCORSRequest = function(method, url) {
    var xhr;
    xhr = new XMLHttpRequest();
    if ((xhr != null ? xhr.withCredentials : void 0) != null) {
      xhr.open(method, url, true);
    } else if (typeof XDomainRequest !== "undefined") {
      xhr = new XDomainRequest();
      xhr.open(method, url);
    } else {
      xhr = null;
    }
    return xhr;
  };

  post = function(url, data, callback) {
    var xhr;
    xhr = createCORSRequest('POST', url);
    if (!xhr) {
      util.debug("Your browser don't support CORS");
      return null;
    }
    xhr.onload = function() {
      var text;
      text = xhr.responseText;
      if (callback) {
        return callback(text);
      }
    };
    xhr.onerror = function() {};
    if (xhr.setRequestHeader) {
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    }
    xhr.send(JSON.stringify(data));
    return xhr;
  };

  module.exports = {
    post: post
  };


  },{"./JSON":3,"./util.coffee":22}],8:[function(require,module,exports){
  var simplePostMessage={k:1};!function($){"$:nomunge";var interval_id,last_hash,cache_bust=1,rm_callback,FALSE=!1,postMessage="postMessage",addEventListener="addEventListener",p_receiveMessage,has_postMessage=window[postMessage];if(typeof window.opera!="undefined"&&window.opera.version&&parseInt(window.opera.version())==9){Event.prototype.__defineGetter__("origin",function(){return"http://"+this.domain})}$[postMessage]=function(message,target_url,target){if(!target_url){return}message=typeof message==="string"?encodeURIComponent(message):encodeURIComponent(JSON.stringify(message));target=target||parent;if(has_postMessage){target[postMessage](message,target_url.replace(/([^:]+:\/\/[^\/]+).*/,"$1"))}else if(target_url){target.location=target_url.replace(/#.*$/,"")+"#"+ +new Date+cache_bust++ +"&"+message}};$.receiveMessage=p_receiveMessage=function(callback,source_origin,delay){if(has_postMessage){if(callback){rm_callback&&p_receiveMessage();rm_callback=function(e){if(typeof source_origin==="string"&&e.origin!==source_origin||typeof source_origin==="function"&&source_origin(e.origin)===FALSE){return FALSE}var f={};for(var i in e)f[i]=e[i];try{f.data=decodeURIComponent(f.data);f.data=JSON.parse(f.data)}catch(ex){}callback(f)}}if(window[addEventListener]){window[callback?addEventListener:"removeEventListener"]("message",rm_callback,FALSE)}else{window[callback?"attachEvent":"detachEvent"]("onmessage",rm_callback)}}else{interval_id&&clearInterval(interval_id);interval_id=null;if(callback){delay=typeof source_origin==="number"?source_origin:typeof delay==="number"?delay:100;interval_id=setInterval(function(){var hash=document.location.hash,re=/^#?\d+&/;if(hash!==last_hash&&re.test(hash)){last_hash=hash;callback({data:hash.replace(re,"")})}},delay)}}}}(simplePostMessage);

  module.exports = simplePostMessage;

  },{}],9:[function(require,module,exports){
  var appendLoadingBar, getItemIdFromHashTag, init, util;

  util = require('./util.coffee');

  getItemIdFromHashTag = function() {
    var hashtag, item_id, ref;
    hashtag = window.location.hash;
    item_id = '';
    if ((hashtag != null ? hashtag.indexOf('dable_bridge_item=') : void 0) > -1) {
      item_id = (ref = hashtag.split('dable_bridge_item=')) != null ? ref[1] : void 0;
    }
    return item_id;
  };

  appendLoadingBar = function(dom_el) {
    return dom_el != null ? dom_el.innerHTML = "<div style=\"text-align: center;\">\n  <img src=\"//images.dable.io/static/i/loading_m.gif\" />\n</div>" : void 0;
  };

  init = function(opts) {
    var dom_id_or_el, el, onItemChange;
    dom_id_or_el = opts.dom_id_or_el, onItemChange = opts.onItemChange;
    if (!dom_id_or_el) {
      return util.debug("dom id or element should be provided");
    } else if (typeof dom_id_or_el !== "string") {
      el = dom_id_or_el;
    } else {
      el = document.getElementById(dom_id_or_el);
    }
    return window.addEventListener("hashchange", function(event) {
      var item_id;
      appendLoadingBar(el);
      item_id = getItemIdFromHashTag();
      return onItemChange(item_id);
    });
  };

  module.exports = {
    init: init,
    getItemIdFromHashTag: getItemIdFromHashTag
  };


  },{"./util.coffee":22}],10:[function(require,module,exports){
  var init, initLoadingIndicator;

  initLoadingIndicator = function(widget_el) {
    var el, ref;
    if (((ref = widget_el.previousSibling) != null ? ref.tagName : void 0) === "u") {
      return;
    }
    el = document.createElement("u");
    el.style.position = "absolute";
    el.style.margin = "-20px 0 0";
    el.style.background = "url(//static.dable.io/static/i/loading_s.gif) no-repeat 50%";
    el.style.width = "20px";
    el.style.height = "20px";
    el.style.display = "none";
    return widget_el.parentNode.insertBefore(el, widget_el);
  };

  init = function(id, content_el_id, renderWidgetMethod) {
    var check, content_el, last_refreshed, loading_el, old_val, refresh_interval_ms, refresh_min_bytes, widget_el;
    widget_el = document.getElementById(id);
    content_el = document.getElementById(content_el_id);
    if (!widget_el || !content_el) {
      setTimeout((function() {
        return init(id, content_el_id);
      }), 300);
    }
    initLoadingIndicator(widget_el);
    loading_el = widget_el.previousSibling;
    refresh_min_bytes = 100;
    refresh_interval_ms = 5000;
    old_val = "";
    last_refreshed = 0;
    check = function() {
      var check_val, val;
      if (content_el == null) {
        return setTimeout((function() {
          return check();
        }), 500);
      }
      val = (content_el != null ? content_el.value : void 0) || "";
      check_val = val.replace(old_val, "");
      if (val.length > refresh_min_bytes && check_val.length > 0) {
        loading_el.style.display = "block";
        renderWidgetMethod(id, val, {
          nolink: 1
        }, function() {
          return loading_el.style.display = "none";
        });
        old_val = val;
        return setTimeout((function() {
          return check();
        }), refresh_interval_ms);
      } else {
        return setTimeout((function() {
          return check();
        }), 300);
      }
    };
    return check();
  };

  module.exports = {
    init: init
  };


  },{}],11:[function(require,module,exports){
  var check, set;

  check = function(key) {
    var arr, cookie_doc, it, j, len, match, ref, regexp, val;
    cookie_doc = (typeof window !== "undefined" && window !== null ? window.COOKIE_DOCUMENT : void 0) || (typeof window !== "undefined" && window !== null ? window.document : void 0);
    val = "";
    arr = ((ref = cookie_doc.cookie) != null ? ref.split(';') : void 0) || [];
    regexp = RegExp("^\\s*" + key + "=\\s*(.*?)\\s*$");
    for (j = 0, len = arr.length; j < len; j++) {
      it = arr[j];
      if (match = it.match(regexp)) {
        val = match[1];
      }
    }
    if (val === "null") {
      val = "";
    }
    return val;
  };

  set = (function(_this) {
    return function(key, value, expire) {
      var cookie_doc, domain, hostname, i, j, val;
      cookie_doc = (typeof window !== "undefined" && window !== null ? window.COOKIE_DOCUMENT : void 0) || (typeof window !== "undefined" && window !== null ? window.document : void 0);
      hostname = window.location.hostname.split('.');
      for (j = hostname.length - 1; j >= 0; j += -1) {
        i = hostname[j];
        domain = hostname.slice(i).join('.');
        val = key + "=" + value + "; path=/; domain=." + domain + "; ";
        val += "expires=" + (new Date((new Date).getTime() + expire).toGMTString()) + ";";
        cookie_doc.cookie = val;
        if (check(key)) {
          _this.domain = domain;
          return;
        }
      }
    };
  })(this);

  module.exports = {
    check_cookie: check,
    set_cookie: set
  };


  },{}],12:[function(require,module,exports){
  var addEvent, postEvent, removeEvent;

  addEvent = function(obj, type, fn, attachEventKey) {
    if (attachEventKey == null) {
      attachEventKey = "";
    }
    if (obj.attachEvent) {
      obj["e" + type + fn + attachEventKey] = fn;
      obj["" + type + fn + attachEventKey] = function() {
        return obj["e" + type + fn + attachEventKey](window.event);
      };
      return obj.attachEvent("on" + type, obj["" + type + fn + attachEventKey]);
    } else {
      return obj.addEventListener(type, fn, false);
    }
  };

  removeEvent = function(obj, type, fn, attachEventKey) {
    if (attachEventKey == null) {
      attachEventKey = "";
    }
    if (obj.detachEvent) {
      obj.detachEvent("on" + type, obj["" + type + fn + attachEventKey]);
      return obj["" + type + fn + attachEventKey] = null;
    } else {
      return obj.removeEventListener(type, fn, false);
    }
  };

  postEvent = function(obj, type, delay) {
    var creator, requiredEvent;
    if (delay == null) {
      delay = 100;
    }
    requiredEvent = void 0;
    creator = void 0;
    if (obj.createEvent) {
      creator = obj;
    } else {
      creator = document;
    }
    requiredEvent = creator.createEvent("Events");
    requiredEvent.initEvent(type, true, false);
    return setTimeout(function() {
      return creator.dispatchEvent(requiredEvent, delay);
    });
  };

  module.exports = {
    addEvent: addEvent,
    removeEvent: removeEvent,
    postEvent: postEvent
  };


  },{}],13:[function(require,module,exports){
  var GA_SLOT, GA_SLOT_LENGTH, GA_SLOT_SIZE, UA, conditionallyRequireGa, send, sendForAd, util;

  util = require('./util.coffee');

  UA = 'UA';

  GA_SLOT = [3, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

  GA_SLOT_SIZE = 400;

  GA_SLOT_LENGTH = 20;

  conditionallyRequireGa = function() {
    if (!window.ga) {
      return (function(i, s, o, g, r, a, m) {
        i['GoogleAnalyticsObject'] = r;
        i[r] = i[r] || (function() {
          return (i[r].q = i[r].q || []).push(arguments);
        });
        i[r].l = 1 * new Date();
        a = s.createElement(o);
        m = s.getElementsByTagName(o)[0];
        a.async = 1;
        a.src = g;
        return m.parentNode.insertBefore(a, m);
      })(window, document, 'script', (util.protocol()) + "//www.google-analytics.com/analytics.js", 'ga');
    }
  };

  send = function(service_name, category1, category2, sample_rate, service_id) {
    var custom_dimentions, ga_id, slot_index;
    if (sample_rate <= 0 || service_id === void 0 || service_name === void 0) {
      return;
    }
    conditionallyRequireGa();
    slot_index = service_id > 0 ? Math.floor(service_id / GA_SLOT_SIZE) : 0;
    if (slot_index >= GA_SLOT_LENGTH) {
      slot_index = GA_SLOT_LENGTH - 1;
    }
    ga_id = UA + '-64397972-' + GA_SLOT[slot_index];
    ga('create', ga_id, 'auto', {
      name: 'dable',
      sampleRate: sample_rate
    });
    custom_dimentions = {};
    if (service_id) {
      custom_dimentions.dimension1 = service_id;
    }
    if (category1) {
      custom_dimentions.dimension2 = category1;
    }
    if (category2) {
      custom_dimentions.dimension3 = category2;
    }
    return ga('dable.send', 'pageview', custom_dimentions);
  };

  sendForAd = function(opts) {
    var campaign_id, content_id, custom_dimentions, service_id;
    campaign_id = opts.campaign_id, content_id = opts.content_id, service_id = opts.service_id;
    conditionallyRequireGa();
    ga('create', UA + '-64397972-4', 'auto', {
      name: 'dablead'
    });
    custom_dimentions = {};
    if (service_id) {
      custom_dimentions.dimension1 = service_id;
    }
    if (campaign_id) {
      custom_dimentions.dimension2 = campaign_id;
    }
    if (content_id) {
      custom_dimentions.dimension3 = content_id;
    }
    return ga('dablead.send', 'pageview', custom_dimentions);
  };

  module.exports = {
    send: send,
    sendForAd: sendForAd
  };


  },{"./util.coffee":22}],14:[function(require,module,exports){
  var JSONP, cookie, ga, logAdNetworkPixel, scrollManager, sendActionLog, util;

  JSONP = require('./JSONP.coffee');

  util = require('./util.coffee');

  ga = require('./ga.coffee');

  scrollManager = require('./scroll-manager.coffee');

  cookie = require('./cookie.coffee');

  logAdNetworkPixel = function(url) {
    var el;
    if (!url) {
      return;
    }
    el = document.createElement("img");
    el.setAttribute("alt", "");
    el.setAttribute("src", url);
    el.width = "1";
    el.height = "1";
    el.style.position = "absolute";
    el.style.top = "-9999px";
    el.style.left = "-9999px";
    return document.body.appendChild(el);
  };

  sendActionLog = function(info, callback) {
    var collect_visit_log_once_a_day, d, payload, payloadAd, seconds, service_name, service_type, url;
    service_type = info.service.service_type;
    service_name = info.site || info.service.service_name;
    collect_visit_log_once_a_day = info.service.collect_visit_log_once_a_day;
    info.z = String(Math.round(Math.random() * 1000000));
    url = (util.protocol()) + "//" + (util.api_server_domain()) + "/logs";
    url += "/services/" + (encodeURIComponent(service_name));
    url += "/users/" + (encodeURIComponent(info.uid)) + "/" + info.action;
    payload = util.clone(info);
    delete payload.service;
    delete payload.sp_client;
    delete payload.uid;
    delete payload.action;
    delete payload.site;
    delete payload.payco_log_url;
    delete payload.kakao_log_url;
    delete payload.adx_log_url;
    if (collect_visit_log_once_a_day && info.action === "visit") {
      if (cookie.check_cookie('__dbl_v')) {
        return;
      } else {
        d = new Date();
        seconds = (23 - d.getHours()) * 60 * 60 + (59 - d.getMinutes()) * 60 + (59 - d.getSeconds());
        cookie.set_cookie('__dbl_v', '1', seconds * 1000);
      }
    }
    JSONP.get(url, payload, function(data) {
      var ref, ref1, ref2, ref3;
      if (data !== "OK") {
        util.debug(data);
      }
      if (callback) {
        callback();
      }
      return ga.send(service_name, (ref = payload.items) != null ? (ref1 = ref[0]) != null ? ref1.c1 : void 0 : void 0, (ref2 = payload.items) != null ? (ref3 = ref2[0]) != null ? ref3.c2 : void 0 : void 0, info.service.ga_sample_rate || 0, info.service.service_id);
    });
    if (service_name === 'jogunshop.com' && (info.action === 'buy' || info.action === 'visit')) {
      if (info.action === 'buy') {
        url = (util.protocol()) + "//" + (util.sp_api_server_domain()) + "/logs";
        url += "/clients/jogunshop.com";
        url += "/users/" + (encodeURIComponent(info.uid)) + "/purchase";
        payloadAd = util.clone(payload);
        payloadAd.value = (function() {
          var i, item, len, ref, sum;
          sum = 0;
          ref = payloadAd.items;
          for (i = 0, len = ref.length; i < len; i++) {
            item = ref[i];
            sum += Number(item.total_sales || 0);
          }
          return sum;
        })();
        payloadAd.currency = "KRW";
        delete payloadAd.items;
        JSONP.get(url, payloadAd, function() {});
      } else if (!cookie.check_cookie('__dbl_jogun_pv')) {
        url = (util.protocol()) + "//" + (util.sp_api_server_domain()) + "/logs";
        url += "/clients/jogunshop.com";
        url += "/users/" + (encodeURIComponent(info.uid)) + "/visit";
        d = new Date();
        seconds = (23 - d.getHours()) * 60 * 60 + (59 - d.getMinutes()) * 60 + (59 - d.getSeconds());
        cookie.set_cookie('__dbl_jogun_pv', '1', seconds * 1000);
        JSONP.get(url, payload, function() {});
      }
    }
    if (info.service.tg_client_name) {
      setTimeout((function(_this) {
        return function() {
          if (!(typeof window !== "undefined" && window !== null ? window.dablena : void 0)) {
            (function(d, a, b, l, e, _) {
              d[b] = d[b] || function() {
                return (d[b].q = d[b].q || []).push(arguments);
              };
              e = a.createElement(l);
              e.async = 1;
              e.charset = 'utf-8';
              e.src = (util.protocol()) + "//static.dable.io/dist/dablena.min.js";
              _ = a.getElementsByTagName(l)[0];
              return _.parentNode.insertBefore(e, _);
            })(window, document, 'dablena', 'script');
          }
          dablena('init', info.service.tg_client_name);
          dablena('isTgClient', 1);
          return dablena('track', 'PageView');
        };
      })(this), 3000);
    }
    logAdNetworkPixel(info.payco_log_url);
    logAdNetworkPixel(info.kakao_log_url);
    return logAdNetworkPixel(info.adx_log_url);
  };

  module.exports = {
    sendActionLog: sendActionLog
  };


  },{"./JSONP.coffee":4,"./cookie.coffee":11,"./ga.coffee":13,"./scroll-manager.coffee":20,"./util.coffee":22}],15:[function(require,module,exports){
  var LZString=function(){function o(o,r){if(!t[o]){t[o]={};for(var n=0;n<o.length;n++)t[o][o.charAt(n)]=n}return t[o][r]}var r=String.fromCharCode,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",t={},i={compressToBase64:function(o){if(null==o)return"";var r=i._compress(o,6,function(o){return n.charAt(o)});switch(r.length%4){default:case 0:return r;case 1:return r+"===";case 2:return r+"==";case 3:return r+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(e){return o(n,r.charAt(e))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(o){return null==o?"":""==o?null:i._decompress(o.length,16384,function(r){return o.charCodeAt(r)-32})},compressToUint8Array:function(o){for(var r=i.compress(o),n=new Uint8Array(2*r.length),e=0,t=r.length;t>e;e++){var s=r.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null===o||void 0===o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;t>e;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(o){return null==o?"":i._compress(o,6,function(o){return e.charAt(o)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(n){return o(e,r.charAt(n))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(o,r,n){if(null==o)return"";var e,t,i,s={},p={},u="",c="",a="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<o.length;i+=1)if(u=o.charAt(i),Object.prototype.hasOwnProperty.call(s,u)||(s[u]=f++,p[u]=!0),c=a+u,Object.prototype.hasOwnProperty.call(s,c))a=c;else{if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++),s[c]=f++,a=String(u)}if(""!==a){if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==r-1){d.push(n(m));break}v++}return d.join("")},decompress:function(o){return null==o?"":""==o?null:i._decompress(o.length,32768,function(r){return o.charCodeAt(r)})},_decompress:function(o,n,e){var t,i,s,p,u,c,a,l,f=[],h=4,d=4,m=3,v="",w=[],A={val:e(0),position:n,index:1};for(i=0;3>i;i+=1)f[i]=i;for(p=0,c=Math.pow(2,2),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(t=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 2:return""}for(f[3]=l,s=l,w.push(l);;){if(A.index>o)return"";for(p=0,c=Math.pow(2,m),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(l=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 2:return w.join("")}if(0==h&&(h=Math.pow(2,m),m++),f[l])v=f[l];else{if(l!==d)return null;v=s+s.charAt(0)}w.push(v),f[d++]=s+v.charAt(0),h--,s=v,0==h&&(h=Math.pow(2,m),m++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module&&(module.exports=LZString);

  },{}],16:[function(require,module,exports){
  var mall, prepare, util;

  util = require('./util.coffee');

  prepare = function(next, script_included) {
    var attr, ref;
    if (script_included == null) {
      script_included = false;
    }
    if (mall.auto) {
      return next();
    } else if (typeof window !== "undefined" && window !== null ? (ref = window.dable) != null ? ref.mall : void 0 : void 0) {
      for (attr in window.dable.mall) {
        mall[attr] = window.dable.mall[attr];
      }
      return next();
    }
    if (!script_included) {
      util.includeScript((util.protocol()) + "//static.dable.io/dist/mall.min.js");
    }
    return setTimeout(function() {
      return prepare(next, true);
    }, 200);
  };

  mall = {
    prepare: prepare
  };

  module.exports = mall;


  },{"./util.coffee":22}],17:[function(require,module,exports){
  var JSONP, ajax_lib, cleansing_image, cleansing_price, cleansing_url, cleansing_value, crc32, get_canonical_link, get_classname_txt, get_id_text, get_meta_value, has_support, is_hidden, read, read_body, read_body_el, read_item, ref, resolve_url, update_item, util;

  ajax_lib = require('./ajax.coffee');

  util = require('./util.coffee');

  JSONP = require('./JSONP.coffee');

  crc32 = require('./crc32.js');

  has_support = function() {
    return (typeof document !== "undefined" && document !== null ? document.querySelectorAll : void 0) != null;
  };

  resolve_url = function(url, path) {
    var info, j, len1, p, path_info;
    info = url.split('/');
    path_info = path.split('/');
    if (path.substr(0, 1) === '/') {
      info.splice(3, info.length);
      path_info.splice(0, 1);
    }
    for (j = 0, len1 = path_info.length; j < len1; j++) {
      p = path_info[j];
      if (p === '..') {
        if (info.length > 3) {
          info.splice(-1, 1);
        }
      } else if (p === '.' || !p) {

      } else {
        info.push(p);
      }
    }
    return info.join('/');
  };

  cleansing_image = function(src) {
    var matches, url;
    if (!src) {
      return '';
    }
    url = location.href;
    matches = src.match(/https?:\/\/[^"^'^>]+/);
    if (matches != null ? matches[0] : void 0) {
      return matches[0];
    }
    matches = src.match(/\/\/[^"^'^\\^>]+/);
    if (matches != null ? matches[0] : void 0) {
      return matches[0];
    }
    matches = src.match(/[ \t\r\n]src="(\.?\.?\/[^"]+)"/);
    if (!matches) {
      matches = src.match(/[ \t\r\n]src='(\.?\.?\/[^']+)'/);
    }
    if (matches != null ? matches[1] : void 0) {
      return resolve_url(url, matches[1]);
    }
    return resolve_url(url, src);
  };

  cleansing_price = function(val) {
    if (val == null) {
      return val;
    }
    val = val.replace(/\r?\n?/g, '');
    val = val.replace(/<script(?:(?!<\/script>).)+(<\/script>)?/ig, '');
    val = val.replace(/<[^>]*>/g, '');
    val = val.replace(/[^0-9^\.]+/g, '');
    return val;
  };

  cleansing_url = function(url) {
    if (url == null) {
      return url;
    }
    url = url.replace(/&amp;/g, '\&');
    url = url.replace(/[\&]utm_[^=^&]+=[^&]+/g, '');
    url = url.replace(/[\?]utm_[^=^&]+=[^&]+/g, '?');
    url = url.replace(/\?\&/, '?');
    return url;
  };

  cleansing_value = function(val, opts) {
    var cut, nocut;
    if (opts == null) {
      opts = {};
    }
    nocut = opts.nocut, cut = opts.cut;
    if (val.match(/\uFFFD/)) {
      return "";
    }
    if (val == null) {
      return "";
    }
    val = val.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '\&').replace(/\s+/g, ' ');
    if (nocut) {
      return val;
    } else if (cut) {
      return val.substr(0, cut);
    } else {
      return val.substr(0, 200);
    }
  };

  get_meta_value = (function() {
    var _meta_els, _meta_els_expires;
    _meta_els = null;
    _meta_els_expires = new Date().valueOf() + 1000;
    return function(property, get_last) {
      var _len, el, i, j, k, len1, ref;
      if (get_last == null) {
        get_last = true;
      }
      if (!_meta_els || _meta_els_expires < new Date().valueOf()) {
        _meta_els = document.getElementsByTagName("meta");
      }
      _len = _meta_els.length;
      if (!_len) {
        return "";
      }
      if (get_last) {
        for (i = j = ref = _meta_els.length - 1; ref <= 0 ? j <= 0 : j >= 0; i = ref <= 0 ? ++j : --j) {
          el = _meta_els[i];
          if (el.getAttribute("property") === property || el.getAttribute("name") === property) {
            return el.getAttribute("content") || "";
          }
        }
      } else {
        for (k = 0, len1 = _meta_els.length; k < len1; k++) {
          el = _meta_els[k];
          if (el.getAttribute("property") === property || el.getAttribute("name") === property) {
            return el.getAttribute("content") || "";
          }
        }
      }
      return "";
    };
  })();

  get_canonical_link = (function() {
    var _link_els;
    _link_els = null;
    return function() {
      var e, el, i, j, ref;
      if (!_link_els) {
        _link_els = document.getElementsByTagName("link");
      }
      try {
        for (i = j = ref = _link_els.length - 1; ref <= 0 ? j <= 0 : j >= 0; i = ref <= 0 ? ++j : --j) {
          el = _link_els[i];
          if (el.getAttribute("rel") === "canonical") {
            return el.getAttribute("href");
          }
        }
      } catch (error) {
        e = error;
        return "";
      }
      return "";
    };
  })();

  get_id_text = function(id) {
    var el;
    el = document.getElementById(id);
    return el != null ? el.innerHTML : void 0;
  };

  get_classname_txt = function(classname) {
    var els, ref;
    els = document.querySelectorAll(classname);
    return els != null ? (ref = els[0]) != null ? ref.innerHTML : void 0 : void 0;
  };

  read_body_el = function() {
    var is_queryselector_support, ref;
    is_queryselector_support = (ref = typeof document.querySelector) === 'object' || ref === 'function';
    return is_queryselector_support && document.querySelector('[itemprop="articleBody"],.__dable_article_body');
  };

  read_body = function() {
    var el;
    if (!has_support()) {
      return null;
    }
    el = read_body_el();
    return (el != null ? el.innerText : void 0) || null;
  };

  read = function(props) {
    var info, j, len1, methods, prop;
    if (!has_support()) {
      return null;
    }
    if (!props) {
      props = ['item_id', 'no_meta_update', 'url', 'title', 'image_url', 'price', 'author', 'currency', 'sale_price', 'sale_currency', 'availability', 'description', 'category1', 'category2', 'category3', 'custom1', 'custom2', 'custom3', 'custom4', 'custom5', 'published_time'];
    }
    methods = {
      no_meta_update: function() {
        return cleansing_value(get_meta_value('dable:no_meta_update'));
      },
      item_id: function() {
        return cleansing_value(get_meta_value('dable:item_id'));
      },
      url: function() {
        var url;
        url = cleansing_url(get_meta_value('dable:url') || get_meta_value('og:url') || get_canonical_link());
        if (url.substr(0, 2) === '//') {
          url = window.location.protocol + url;
        }
        return url;
      },
      title: function() {
        return cleansing_value(get_classname_txt('.__dable_title') || get_meta_value('dable:title') || get_meta_value('og:title') || get_meta_value('title') || document.title);
      },
      image_url: function() {
        var url;
        url = cleansing_image(get_meta_value('dable:image') || get_meta_value('og:image') || get_meta_value('og:image:url'));
        if (url.substr(0, 2) === '//') {
          url = window.location.protocol + url;
        }
        return url;
      },
      price: function() {
        return cleansing_price(get_classname_txt('.__dable_price') || get_meta_value('product:price:amount'));
      },
      author: function() {
        return cleansing_value(get_meta_value('product:brand') || get_meta_value('dable:author') || get_meta_value('article:author') || get_meta_value('author')) || null;
      },
      currency: function() {
        return cleansing_value(get_meta_value('product:price:currency'));
      },
      sale_price: function() {
        return cleansing_price(get_meta_value('product:sale_price:amount'));
      },
      sale_currency: function() {
        return cleansing_value(get_meta_value('product:sale_price:currency'));
      },
      availability: function() {
        var els, out_of_stock, ref, ref1, sold_out_display;
        out_of_stock = null;
        els = document.querySelectorAll('[data-dable-availability]');
        if (els != null ? (ref = els[0]) != null ? ref.hasAttribute('data-dable-availability') : void 0 : void 0) {
          sold_out_display = els != null ? (ref1 = els[0]) != null ? ref1.getAttribute('data-dable-availability') : void 0 : void 0;
          if (sold_out_display !== "displaynone") {
            out_of_stock = 'oos';
          }
        }
        if (!out_of_stock) {
          out_of_stock = (get_classname_txt('.__dable_availability') && 'oos') || get_meta_value('product:availability') || null;
        }
        return out_of_stock;
      },
      description: function() {
        return cleansing_value(get_meta_value('dable:description') || get_meta_value('og:description')).substr(0, 100);
      },
      category1: function() {
        return cleansing_value(get_id_text('article:section') || get_meta_value('article:section') || get_meta_value('product:category'), {
          cut: 64
        });
      },
      category2: function() {
        return cleansing_value(get_meta_value('article:section2') || get_meta_value('product:category2'), {
          cut: 64
        });
      },
      category3: function() {
        return cleansing_value(get_meta_value('article:section3') || get_meta_value('product:category3'), {
          cut: 64
        });
      },
      custom1: function() {
        return cleansing_value(get_meta_value('dable:custom1'));
      },
      custom2: function() {
        return cleansing_value(get_meta_value('dable:custom2'));
      },
      custom3: function() {
        return cleansing_value(get_meta_value('dable:custom3'));
      },
      custom4: function() {
        return cleansing_value(get_meta_value('dable:custom4'));
      },
      custom5: function() {
        return cleansing_value(get_meta_value('dable:custom5'));
      },
      published_time: function() {
        return cleansing_value(get_meta_value('dable:published_time') || get_meta_value('article:published_time')) || null;
      }
    };
    info = {};
    for (j = 0, len1 = props.length; j < len1; j++) {
      prop = props[j];
      info[prop] = methods[prop]();
    }
    return info;
  };

  read_item = (function() {
    return function(fields) {
      var info, j, len1, methods, prop;
      if (!fields) {
        fields = ['item_id', 'url', 'category1', 'category2', 'category3', 'comment_count'];
      }
      methods = {
        item_id: function() {
          return cleansing_value(get_meta_value('dable:item_id'));
        },
        url: function() {
          var url;
          url = cleansing_url(get_meta_value('dable:url') || get_meta_value('og:url') || get_canonical_link());
          if (url.substr(0, 2) === '//') {
            url = 'http:' + url;
          }
          return url;
        },
        category1: function() {
          return cleansing_value(get_id_text('article:section') || get_meta_value('article:section') || get_meta_value('product:category'), {
            cut: 64
          });
        },
        category2: function() {
          return cleansing_value(get_meta_value('article:section2') || get_meta_value('product:category2'), {
            cut: 64
          });
        },
        category3: function() {
          return cleansing_value(get_meta_value('article:section3') || get_meta_value('product:category3'), {
            cut: 64
          });
        },
        comment_count: function() {
          return cleansing_value(get_meta_value('dable:comment_count'));
        }
      };
      info = {};
      for (j = 0, len1 = fields.length; j < len1; j++) {
        prop = fields[j];
        info[prop] = methods[prop]();
      }
      return info;
    };
  })();

  is_hidden = function(action_type) {
    var do_skip, is_oos;
    do_skip = function() {
      if (action_type !== 'view') {
        return true;
      }
      return !/dable=/.test(window.location.href);
      return !has_support();
    };
    is_oos = function() {
      return read(['availability']).availability === 'oos';
    };
    if (do_skip()) {
      return false;
    }
    return is_oos();
  };

  update_item = function(service_name, items, opts) {
    var ref;
    if ((items != null ? items.length : void 0) === 0 || !(items != null ? (ref = items[0]) != null ? ref.id : void 0 : void 0)) {
      return;
    }
    if (!has_support()) {
      return;
    }
    return setTimeout(function() {
      var info, is_update_article_body, item_id, ref1, ref2, url;
      is_update_article_body = opts.is_update_article_body;
      item_id = items != null ? items[0].id : void 0;
      info = read();
      if (!info || !info.title || info.no_meta_update === "true") {
        return;
      }
      if (info.item_id && item_id !== info.item_id) {
        return;
      }
      if (info.title.match(/[\uFFF0-\uFFFF]+/)) {
        return;
      }
      if (info.title.match(/[ÁÄÀÃÅÃÂ]+/)) {
        return;
      }
      if (service_name === 'superich.co.kr' && (typeof window !== "undefined" && window !== null ? (ref1 = window.navigator) != null ? (ref2 = ref1.userAgent) != null ? ref2.indexOf('IE') : void 0 : void 0 : void 0) === -1) {
        return;
      }
      url = (util.protocol()) + "//" + (util.api_server_domain()) + "/items/services";
      url += "/" + (encodeURIComponent(service_name)) + "/id";
      url += "/" + (encodeURIComponent(item_id)) + "/checksum";
      return JSONP.get(url, {}, function(data) {
        var _description, _url, body, len, new_checksum, old_body_length, old_checksum, ref3, ref4, ref5, xhr;
        old_checksum = data != null ? (ref3 = data.result) != null ? ref3.checksum : void 0 : void 0;
        old_body_length = data != null ? (ref4 = data.result) != null ? ref4.body_length : void 0 : void 0;
        if (old_checksum === 'BLOCKED') {
          return;
        }
        _url = info.url;
        _description = info.description;
        delete info.url;
        delete info.description;
        delete info.no_meta_update;
        delete info.item_id;
        new_checksum = crc32(info);
        if (_url) {
          info.url = _url;
        }
        if (_description) {
          info.description = _description.substr(0, 100);
        }
        if (new_checksum !== old_checksum) {
          info.body_length = ((ref5 = read_body()) != null ? ref5.length : void 0) || 0;
        }
        url = (util.protocol()) + "//" + (util.api_server_domain()) + "/items/services";
        url += "/" + (encodeURIComponent(service_name)) + "/id";
        url += "/" + (encodeURIComponent(item_id)) + "/update";
        if (is_update_article_body) {
          body = read_body();
          len = (body != null ? body.length : void 0) || 0;
          if (len > 100 && (len / old_body_length > 1.1 || len / old_body_length < 0.9)) {
            info.articleBody = body;
            xhr = ajax_lib.post(url, info, function() {});
            if (xhr) {
              return;
            }
            delete info.articleBody;
          }
        }
        if (new_checksum === old_checksum) {
          return;
        }
        return JSONP.get(url, info, function() {});
      });
    }, window.TEST_META_UPDATE_DELAY || 5000);
  };

  if (typeof window !== "undefined" && window !== null) {
    if ((ref = window.dable) != null) {
      ref.__meta_test = read;
    }
  }

  module.exports = {
    read: read,
    read_body: read_body,
    read_body_el: read_body_el,
    read_item: read_item,
    get_meta_value: get_meta_value,
    is_hidden: is_hidden,
    update_item: update_item,
    cleansing_value: cleansing_value
  };


  },{"./JSONP.coffee":4,"./ajax.coffee":7,"./crc32.js":31,"./util.coffee":22}],18:[function(require,module,exports){
  var channels, publish, subscribe, subscriberCount, unsubscribe;

  channels = {};

  subscriberCount = -1;

  subscribe = function(channel, func) {
    var subscriberId;
    if (channels[channel] == null) {
      channels[channel] = [];
    }
    subscriberId = (++subscriberCount).toString();
    channels[channel].push({
      subscriberId: subscriberId,
      func: func
    });
    return subscriberId;
  };

  publish = function(channel, args) {
    if (!channels[channel]) {
      return false;
    }
    setTimeout(function() {
      var len, results, subscribers;
      subscribers = channels[channel];
      len = subscribers.length || 0;
      results = [];
      while (len--) {
        results.push(subscribers[len].func(args));
      }
      return results;
    }, 0);
    return true;
  };

  unsubscribe = function(subscriberId) {
    var i, idx, item, j, len1, len2, m, ref;
    for (i = 0, len1 = channels.length; i < len1; i++) {
      m = channels[i];
      if (channels[m]) {
        ref = channels[m];
        for (idx = j = 0, len2 = ref.length; j < len2; idx = ++j) {
          item = ref[idx];
          if (item.subscriberId === subscriberId) {
            channels[m].splice(idx, 1);
            return subscriberId;
          }
        }
      }
    }
    return false;
  };

  module.exports = {
    publish: publish,
    subscribe: subscribe,
    unsubscribe: unsubscribe
  };


  },{}],19:[function(require,module,exports){
  var REFERER_PATTERNS, decodeURIEvenEUCKR, fetchQueryTerm, getParameter, getRefererPattern, util;

  util = require('./util.coffee');

  REFERER_PATTERNS = [
    {
      path: /(www\.)?bing\.com\/search/,
      param: "q"
    }, {
      path: "search.zum.com/search.zum",
      param: "query"
    }, {
      path: /(www\.)?google\.[a-z\.]+\/search/,
      param: "q"
    }, {
      path: /[a-z\.]*search\.naver\.com\/search\.naver/,
      param: "query"
    }, {
      path: /[a-z\.]*search\.daum\.net\/search/,
      param: "q"
    }
  ];

  decodeURIEvenEUCKR = function(term, callback) {
    var e, result;
    try {
      result = decodeURIComponent(term);
      return callback(result);
    } catch (error) {
      e = error;
      return JSONP.get((util.protocol()) + "//api.dable.io/util/decodeuriforeuckr", {
        str: term
      }, function(data) {
        return callback(data.result);
      });
    }
  };

  getParameter = function(url, name) {
    var i, len, p, params;
    if (url.indexOf("?") === -1) {
      return null;
    }
    params = url.substr(url.indexOf("?") + 1).split('&');
    for (i = 0, len = params.length; i < len; i++) {
      p = params[i];
      if (p.indexOf(name + "=") === 0) {
        return p.substr(p.indexOf("=") + 1);
      }
    }
    return null;
  };

  getRefererPattern = function(url) {
    var i, len, p, pattern;
    pattern = null;
    for (i = 0, len = REFERER_PATTERNS.length; i < len; i++) {
      p = REFERER_PATTERNS[i];
      if (p.path instanceof RegExp && p.path.test(url)) {
        pattern = p;
      } else if (typeof p.path === "string" && url.indexOf(p.path) > -1) {
        pattern = p;
      }
    }
    return pattern;
  };

  fetchQueryTerm = function(url, cb) {
    var pattern, term;
    pattern = getRefererPattern(url);
    if (!pattern) {
      return cb(null);
    }
    term = getParameter(url, pattern.param);
    return decodeURIEvenEUCKR(term, function(dterm) {
      return cb(dterm);
    });
  };

  module.exports = {
    fetch: fetchQueryTerm
  };


  },{"./util.coffee":22}],20:[function(require,module,exports){
  var checkExposeDurationElapse, checkScroll, event, exists, handleScroll, isElWithinOffsetY, listen, listenByElement, listeners, tid, unlisten, util,
    slice = [].slice;

  event = require('./event.coffee');

  util = require('./util.coffee');

  tid = null;

  listeners = [];

  checkExposeDurationElapse = function(listener, scrollY) {
    var i_current, j, l_current, len, results;
    listener.elapsed_milisec = listener.elapsed_milisec + 100;
    if (listener.elapsed_milisec >= 1000) {
      results = [];
      for (i_current = j = 0, len = listeners.length; j < len; i_current = ++j) {
        l_current = listeners[i_current];
        if (!l_current) {
          break;
        }
        if (l_current.interval_id === listener.interval_id) {
          listeners.splice(i_current, 1);
          listener.cb(scrollY);
          clearInterval(listener.interval_id);
          results.push(listener.isIntervalRegistered = false);
        } else {
          results.push(void 0);
        }
      }
      return results;
    }
  };

  checkScroll = function() {
    var i, j, l, len, results, wy;
    wy = util.getScrollY();
    results = [];
    for (i = j = 0, len = listeners.length; j < len; i = ++j) {
      l = listeners[i];
      if (!l) {
        break;
      }
      if (!l.isWatchWithTimer) {
        if (l.offsety <= wy) {
          listeners.splice(i, 1);
          results.push(l.cb(wy));
        } else {
          results.push(void 0);
        }
      } else {
        if (l.offsety <= wy && wy <= l.posEndY) {
          if (!l.isIntervalRegistered) {
            l.isIntervalRegistered = true;
            results.push(l.interval_id = setInterval(checkExposeDurationElapse.bind(null, l, wy), 100));
          } else {
            results.push(void 0);
          }
        } else {
          if (l.isIntervalRegistered) {
            l.isIntervalRegistered = false;
            clearInterval(l.interval_id);
            results.push(l.elapsed_milisec = 0);
          } else {
            results.push(void 0);
          }
        }
      }
    }
    return results;
  };

  handleScroll = function() {
    if (tid) {
      clearTimeout(tid);
    }
    return tid = setTimeout(checkScroll, 100);
  };

  event.addEvent(util.get_scroll_base_el(), "scroll", handleScroll, Math.random() * 999999);

  listen = function(opts, cb) {
    var isWatchWithTimer, offsety, posEndY, ref, ref1;
    offsety = opts.offsety, isWatchWithTimer = (ref = opts.isWatchWithTimer) != null ? ref : false, posEndY = (ref1 = opts.posEndY) != null ? ref1 : 0;
    listeners.push({
      offsety: offsety,
      isWatchWithTimer: isWatchWithTimer,
      posEndY: posEndY,
      elapsed_milisec: 0,
      cb: cb
    });
    return checkScroll();
  };

  exists = function(cb) {
    var j, l, len;
    for (j = 0, len = listeners.length; j < len; j++) {
      l = listeners[j];
      if (l.cb === cb) {
        return true;
      }
    }
    return false;
  };

  unlisten = function(cb) {
    var i, j, l, len, results;
    results = [];
    for (i = j = 0, len = listeners.length; j < len; i = ++j) {
      l = listeners[i];
      if (l.cb === cb) {
        clearTimeout(l.interval_id);
        listeners.splice(i, 1);
        break;
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  listenByElement = function(opts) {
    var _method, _method_triggered, e, isWatchWithTimer, method, offsetY, ref, ref1, ref2, register, reregisterIntervalMs, targetElement;
    targetElement = opts.targetElement, method = opts.method, offsetY = (ref = opts.offsetY) != null ? ref : 0, reregisterIntervalMs = (ref1 = opts.reregisterIntervalMs) != null ? ref1 : null, isWatchWithTimer = (ref2 = opts.isWatchWithTimer) != null ? ref2 : false;
    _method_triggered = false;
    _method = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      _method_triggered = true;
      return method.apply(null, args);
    };
    register = function(isFirst) {
      var elOffsetY, posEndY, posY;
      if (_method_triggered) {
        return;
      }
      if (!isFirst) {
        unlisten(_method);
      }
      elOffsetY = util.getOffsetY(targetElement);
      if (elOffsetY !== false) {
        posY = elOffsetY - util.getHeight().viewport + offsetY;
        posEndY = elOffsetY + offsetY;
        opts = {
          offsety: posY,
          isWatchWithTimer: isWatchWithTimer,
          posEndY: posEndY
        };
        listen(opts, _method);
      }
      if (reregisterIntervalMs) {
        return setTimeout(register, reregisterIntervalMs);
      }
    };
    try {
      top.window.location.href;
      return register(true);
    } catch (error) {
      e = error;
      return method(null);
    }
  };

  isElWithinOffsetY = function(opts) {
    var e, elOffsetY, offsetY, posY, ref, targetElement, wy;
    targetElement = opts.targetElement, offsetY = (ref = opts.offsetY) != null ? ref : 0;
    try {
      top.window.location.href;
    } catch (error) {
      e = error;
      return true;
    }
    wy = util.getScrollY();
    elOffsetY = util.getOffsetY(targetElement);
    if (elOffsetY !== false) {
      posY = elOffsetY - util.getHeight().viewport + offsetY;
      return posY <= wy;
    } else {
      return false;
    }
  };

  module.exports = {
    listen: listen,
    listenByElement: listenByElement,
    exists: exists,
    unlisten: unlisten,
    isElWithinOffsetY: isElWithinOffsetY
  };


  },{"./event.coffee":12,"./util.coffee":22}],21:[function(require,module,exports){
  var close, createPopupIfNotExists, isCssApplied, popup_frame_id, popup_id, ref, show, util;

  util = require('../util.coffee');

  popup_id = "ds-popup-" + (parseInt(Math.random() * 999999));

  popup_frame_id = "ds-frame-" + (parseInt(Math.random() * 999999));

  createPopupIfNotExists = function(arg) {
    var campaign_id, custom_h, custom_w, el, el2, el3, h, is_mobile, w;
    campaign_id = arg.campaign_id, is_mobile = arg.is_mobile, custom_w = arg.custom_w, custom_h = arg.custom_h;
    if (document.getElementById(popup_id)) {
      return;
    }
    el = document.createElement("div");
    el.id = popup_id;
    el.style.position = "fixed";
    el.style.zIndex = "99999999";
    el.style.top = "0";
    el.style.right = "0";
    el.style.bottom = "0";
    el.style.left = "0";
    el.style.textAlign = "center";
    el.style.display = "none";
    el.style.overflow = "auto";
    el2 = document.createElement("div");
    el2.style.position = "fixed";
    el2.style.top = "0";
    el2.style.right = "0";
    el2.style.bottom = "0";
    el2.style.left = "0";
    el2.style.backgroundColor = "#000";
    el2.style.opacity = ".8";
    el2.style.filter = 'alpha(opacity=80)';
    el2.onclick = close;
    el3 = document.createElement("div");
    el3.className = "dable-minicontent-wrap";
    if (is_mobile) {
      w = custom_w || "95%";
      h = custom_h || "100%";
      el3.style.position = "fixed";
      el3.style.top = "0";
      el3.style.right = "0";
      el3.style.bottom = "0";
      el3.style.left = "0";
      if (/^[0-9]+$/.test(h)) {
        h = Number(h);
        el3.style.top = "50%";
        el3.style.bottom = "auto";
        el3.style.marginTop = "-" + (h / 2) + "px";
      }
    } else {
      w = custom_w || 550;
      h = custom_h || Math.max(util.getHeight().viewport - 100, 400);
      el3.style.position = "absolute";
      el3.style.top = "50px";
      el3.style.left = "50%";
      el3.style.margin = "0 0 0 -" + (w / 2) + "px";
      el3.style.width = w + "px";
      el3.style.height = h + "px";
      el3.style.borderRadius = "2px";
    }
    el3.innerHTML = "<iframe src='about:blank' id='" + popup_frame_id + "' width='" + w + "' height='" + h + "' frameborder='0' scrolling='yes' ></iframe>";
    el.appendChild(el2);
    el.appendChild(el3);
    return document.body.appendChild(el);
  };

  isCssApplied = false;

  show = function(arg) {
    var campaign_id, content_id, custom_h, custom_w, f, isIOS, is_content_request, is_mobile, nocache, p, ref, ref1, ref2, service_name;
    campaign_id = arg.campaign_id, content_id = arg.content_id, service_name = (ref = arg.service_name) != null ? ref : '', is_content_request = (ref1 = arg.is_content_request) != null ? ref1 : false, is_mobile = arg.is_mobile, nocache = (ref2 = arg.nocache) != null ? ref2 : false, custom_w = arg.custom_w, custom_h = arg.custom_h;
    if (!isCssApplied) {
      isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        util.insertCss(".dable-minicontent-body{overflow:hidden;position:fixed;}");
      } else {
        util.insertCss(".dable-minicontent-body{overflow:hidden;}");
      }
      util.insertCss(".dable-minicontent-wrap{overflow:auto;-webkit-overflow-scrolling:touch}");
      isCssApplied = true;
    }
    createPopupIfNotExists({
      campaign_id: campaign_id,
      is_mobile: is_mobile,
      custom_w: custom_w,
      custom_h: custom_h
    });
    p = document.getElementById(popup_id);
    f = document.getElementById(popup_frame_id);
    f.src = ((util.protocol()) + "//news.dable.io/" + (encodeURIComponent(campaign_id + "-" + content_id)) + "/minicontent") + ("?is_mobile=" + (is_mobile && '1' || '')) + ("&from=" + (encodeURIComponent(window.location.href))) + ("&service_name=" + (encodeURIComponent(service_name))) + (is_content_request && "&is_content_request=1" || "") + (nocache && "&nocache=1" || "");
    p.style.display = "block";
    return document.body.className += " dable-minicontent-body";
  };

  close = function() {
    var el;
    el = document.getElementById(popup_id);
    document.body.className = document.body.className.replace(" dable-minicontent-body", "");
    if (!el) {
      return;
    }
    return el.parentNode.removeChild(el);
  };

  if (typeof window !== "undefined" && window !== null) {
    if ((ref = window.dable) != null) {
      ref.__minicontent = {
        show: show,
        close: close
      };
    }
  }

  module.exports = {
    show: show,
    close: close
  };


  },{"../util.coffee":22}],22:[function(require,module,exports){
  var SEARCH_PARENT_MAX_TRY, _blah, _parent, _protocol, _scroll_base_el, _try_count, _win, arrFrames, e, f, i, is_parent_window_exists_and_accessible, len, parent_frame, ref, util;

  is_parent_window_exists_and_accessible = false;

  SEARCH_PARENT_MAX_TRY = 10;

  try {
    _win = window;
    _parent = null;
    _try_count = 0;
    while (_try_count < SEARCH_PARENT_MAX_TRY) {
      if (_win.parent !== _win) {
        _parent = _win.parent;
        _blah = _parent.window.innerHeight;
        parent_frame = null;
        arrFrames = _parent.document.getElementsByTagName("iframe");
        for (i = 0, len = arrFrames.length; i < len; i++) {
          f = arrFrames[i];
          if (f.contentWindow === _win) {
            parent_frame = f;
          }
        }
        is_parent_window_exists_and_accessible = !!parent_frame;
        if (!(arrFrames != null ? arrFrames.length : void 0) || !is_parent_window_exists_and_accessible) {
          break;
        }
        _win = _win.parent.window;
        _try_count++;
      } else {
        break;
      }
    }
  } catch (error) {
    e = error;
  }

  _scroll_base_el = window;

  _protocol = (typeof window !== "undefined" && window !== null ? (ref = window.location) != null ? ref.protocol : void 0 : void 0) === "https:" ? "https:" : "http:";

  util = {
    is_parent_window_exists_and_accessible: function() {
      return is_parent_window_exists_and_accessible;
    },
    root_window: function() {
      return _win;
    },
    get_scroll_base_el: function() {
      return _scroll_base_el;
    },
    set_scroll_base_el: function(el) {
      return _scroll_base_el = el;
    },
    get_parent_frame: function(el) {
      var doc, j, len1, win;
      doc = el.ownerDocument;
      win = doc.defaultView || doc.parentWindow;
      try {
        arrFrames = win.parent.document.getElementsByTagName("iframe");
        for (j = 0, len1 = arrFrames.length; j < len1; j++) {
          f = arrFrames[j];
          if (f.contentWindow === win) {
            return f;
          }
        }
      } catch (error) {
        e = error;
      }
      return null;
    },
    api_server_domain: function() {
      return (typeof window !== "undefined" && window !== null ? window.TEST_API_SERVER_DOMAIN : void 0) || "api.dable.io";
    },
    sp_api_server_domain: function() {
      return (typeof window !== "undefined" && window !== null ? window.TEST_SP_API_SERVER_DOMAIN : void 0) || "sp-api.dable.io";
    },
    set_protocol: function(p) {
      return _protocol = p;
    },
    protocol: function() {
      return _protocol;
    },
    debug: function(msg) {
      var ref1;
      try {
        return (ref1 = window.console) != null ? typeof ref1.log === "function" ? ref1.log("Dable DEBUG: " + msg) : void 0 : void 0;
      } catch (error) {
        e = error;
      }
    },
    attr: function(el, attr) {
      return el.getAttribute(attr);
    },
    isArray: function(obj) {
      return Object.prototype.toString.call(obj) === "[object Array]";
    },
    getUidGroup: function(uid) {
      var uid_last_num, uid_part;
      uid_part = String(uid).split('.')[0];
      uid_last_num = parseInt(uid_part.substr(uid_part.length - 1, 1), 10);
      return uid_last_num;
    },
    isSafari: function() {
      var n;
      n = navigator.userAgent.toLowerCase();
      return n.indexOf('safari') !== -1 && n.indexOf('chrome') === -1 && n.indexOf('crios') === -1 && n.indexOf('fxios') === -1;
    },
    isMobileDevice: function() {
      var n;
      n = navigator.userAgent || "";
      return /(android).+mobile|\(.*ip(hone|od)|opera m(ob|in)i/i.test(n);
    },
    isMobileView: function() {
      var ref1, ref2, test_by_ua, test_by_width, w;
      w = window.innerWidth || ((ref1 = document.documentElement) != null ? ref1.clientWidth : void 0) || ((ref2 = document.body) != null ? ref2.clientWidth : void 0);
      test_by_width = w <= 500;
      test_by_ua = util.isMobileDevice();
      return test_by_ua || test_by_width;
    },
    isIOSDevice: function() {
      var n;
      n = navigator.userAgent.toLowerCase();
      return /ip(hone|od|ad)/i.test(n);
    },
    isScrollBottom: function(el, extra_px) {
      var doc, innerHeight, offsetHeight, ref1, ref2, ref3, ref4, ref5, win, y;
      if (extra_px == null) {
        extra_px = 10;
      }
      if (is_parent_window_exists_and_accessible) {
        try {
          win = parent;
          doc = parent.document;
        } catch (error) {
          e = error;
          false;
        }
      } else {
        win = window;
        doc = document;
      }
      offsetHeight = el && (util.getElemHeight(el) + util.getOffsetY(el)) || doc.body.offsetHeight;
      y = 0;
      if (util.get_scroll_base_el() !== win && ((ref1 = util.get_scroll_base_el()) != null ? ref1.scrollTop : void 0)) {
        y = util.get_scroll_base_el().scrollTop;
      } else if (typeof win.pageYOffset === 'number') {
        y = win.pageYOffset;
      } else if ((ref2 = doc.documentElement) != null ? ref2.scrollTop : void 0) {
        y = doc.documentElement.scrollTop;
      } else if ((ref3 = doc.body) != null ? ref3.scrollTop : void 0) {
        y = doc.body.scrollTop;
      }
      innerHeight = win.innerHeight || ((ref4 = doc.documentElement) != null ? ref4.clientHeight : void 0) || ((ref5 = doc.body) != null ? ref5.clientHeight : void 0);
      return innerHeight + y >= offsetHeight - extra_px;
    },
    getScrollY: function() {
      var doc, ref1, ref2, ref3, win, y;
      if (is_parent_window_exists_and_accessible) {
        try {
          win = parent;
          doc = parent.document;
        } catch (error) {
          e = error;
          win = window;
          doc = document;
        }
      } else {
        win = window;
        doc = document;
      }
      y = 0;
      if (util.get_scroll_base_el() !== win && ((ref1 = util.get_scroll_base_el()) != null ? ref1.scrollTop : void 0)) {
        y = util.get_scroll_base_el().scrollTop;
      } else if (typeof win.pageYOffset === 'number' && win.pageYOffset !== 0) {
        y = win.pageYOffset;
      } else if ((ref2 = doc.documentElement) != null ? ref2.scrollTop : void 0) {
        y = doc.documentElement.scrollTop;
      } else if ((ref3 = doc.body) != null ? ref3.scrollTop : void 0) {
        y = doc.body.scrollTop;
      }
      return y;
    },
    getHeight: function() {
      var body, html, win;
      if (is_parent_window_exists_and_accessible) {
        win = util.root_window();
      } else {
        win = window;
      }
      body = win.document.body;
      html = win.document.documentElement || document.body;
      return {
        viewport: win.innerHeight || html.clientHeight,
        window: Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight)
      };
    },
    getElemHeight: function(elem) {
      return elem != null ? elem.offsetHeight : void 0;
    },
    isHidden: function(el) {
      return el.offsetWidth === 0 && el.offsetHeight === 0;
    },
    getOffset: function(el, is_parent) {
      var doc, el_org, p_offset, win, x, y;
      if (is_parent == null) {
        is_parent = false;
      }
      el_org = el;
      if (!is_parent && util.isHidden(el)) {
        return false;
      }
      x = 0;
      y = 0;
      if (el) {
        while (true) {
          x += el.offsetLeft || 0;
          y += el.offsetTop || 0;
          el = el.offsetParent;
          if (!el) {
            break;
          }
        }
      }
      try {
        doc = el_org.ownerDocument;
        win = doc.defaultView || doc.parentWindow;
        if (is_parent_window_exists_and_accessible && win.parent !== win) {
          p_offset = util.getOffset(util.get_parent_frame(el_org), true);
          return {
            x: x + p_offset.x,
            y: y + p_offset.y
          };
        } else {
          return {
            x: x,
            y: y
          };
        }
      } catch (error) {
        e = error;
        return {
          x: x,
          y: y
        };
      }
    },
    getOffsetY: function(el) {
      var offset;
      offset = util.getOffset(el);
      if (offset) {
        return offset.y;
      } else {
        return false;
      }
    },
    readParam: (function() {
      var item, j, k, len1, params, ref1, ref2, ref3, s, v;
      s = (typeof window !== "undefined" && window !== null ? (ref1 = window.location) != null ? ref1.search : void 0 : void 0) || '';
      params = {};
      ref2 = s.substr(1).split('&');
      for (j = 0, len1 = ref2.length; j < len1; j++) {
        item = ref2[j];
        ref3 = item.split('='), k = ref3[0], v = ref3[1];
        if (!k || !v) {
          continue;
        }
        params[k] = v;
      }
      return function(param) {
        return params[param];
      };
    })(),
    clone: function(obj) {
      var key, temp;
      if (obj === null || typeof obj !== 'object' || 'isActiveClone' in obj) {
        return obj;
      }
      temp = obj.constructor();
      for (key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          obj['isActiveClone'] = null;
          temp[key] = util.clone(obj[key]);
          delete obj['isActiveClone'];
        }
      }
      return temp;
    },
    isWifi: function() {
      var connection;
      connection = (typeof navigator !== "undefined" && navigator !== null ? navigator.connection : void 0) || (typeof navigator !== "undefined" && navigator !== null ? navigator.mozConnection : void 0) || (typeof navigator !== "undefined" && navigator !== null ? navigator.webkitConnection : void 0);
      if (!connection) {
        return null;
      }
      return (connection != null ? connection.type : void 0) === "wifi";
    },
    getFullUserLanguage: function() {
      var lang, ref1;
      return lang = ((ref1 = navigator.languages) != null ? ref1[0] : void 0) || navigator.language || navigator.userLanguage || "ko";
    },
    getUserLanguage: function() {
      var j, l, lang, langOrLocale, len1, needLocale;
      langOrLocale = util.getFullUserLanguage();
      needLocale = ['zh-TW', 'zh-CN'];
      lang = langOrLocale.split("-")[0].toLowerCase();
      for (j = 0, len1 = needLocale.length; j < len1; j++) {
        l = needLocale[j];
        if (l === langOrLocale) {
          lang = langOrLocale;
        }
      }
      return lang;
    },
    includeScript: function(src) {
      var js;
      js = document.createElement("script");
      js.type = "text/javascript";
      js.src = src;
      return document.getElementsByTagName('head')[0].appendChild(js);
    },
    stripAndExecuteScript: function(text) {
      var cleaned, head, j, len1, ref1, s, scriptElement, script_srcs, scripts;
      script_srcs = [];
      scripts = '';
      cleaned = text.replace(/<script[^>]* src=['"]([^>^'^"^ ]+)[^>]*><\/script>/gi, function() {
        script_srcs.push(arguments[1]);
        return '';
      });
      cleaned = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, function() {
        scripts += arguments[1] + '\n';
        return '';
      });
      for (j = 0, len1 = script_srcs.length; j < len1; j++) {
        s = script_srcs[j];
        util.includeScript(s);
      }
      if (window.execScript) {
        try {
          if (scripts) {
            window.execScript(scripts);
          }
        } catch (error) {
          e = error;
          if (typeof window !== "undefined" && window !== null ? (ref1 = window.console) != null ? ref1.log : void 0 : void 0) {
            if (typeof console !== "undefined" && console !== null) {
              console.log(e);
            }
          }
        }
      } else {
        head = document.getElementsByTagName('head')[0];
        scriptElement = document.createElement('script');
        scriptElement.setAttribute('type', 'text/javascript');
        scriptElement.innerText = scripts;
        head.appendChild(scriptElement);
        head.removeChild(scriptElement);
      }
      return cleaned;
    },
    getReferrer: function() {
      var r, ref1, ref2;
      r = document.referrer;
      if ((r != null ? r.indexOf('api.dable.io/widgets') : void 0) > -1) {
        return decodeURIComponent(((ref1 = r.split('from=')[1]) != null ? (ref2 = ref1.split('&')) != null ? ref2[0] : void 0 : void 0) || r);
      }
      return r;
    },
    insertCss: function(code) {
      var style;
      style = document.createElement('style');
      style.type = 'text/css';
      if (style.styleSheet) {
        style.styleSheet.cssText = code;
      } else {
        style.innerHTML = code;
      }
      return document.getElementsByTagName("head")[0].appendChild(style);
    }
  };

  module.exports = util;


  },{}],23:[function(require,module,exports){
  var JSON, JSONP, Widget, adult, auto_val, closeDablePopup, dable_popup_id, event, floatingWidget, getFrame, getFrameKeyBlacklist, inarticleWidget, infiniteFeedWidget, insertAdWidget, insertAdsense, insertAdsenseLibrary, insertFrame, insertWiderplanetAd, isIECompatabilityMode, lz, meta, minicontent, onReady, postRequestToFrame, preparePassback, pubsub, scrollManager, secretWidget, sendMessage, setFrameHeight, setFrameTitle, showDablePopup, simplePostMessage, upDownWidget, util, widgets,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  JSON = require('./JSON');

  JSONP = require('./JSONP.coffee');

  pubsub = require('./pubsub.coffee');

  util = require('./util.coffee');

  simplePostMessage = require('./ba-postmessage.js');

  adult = require('./adult.coffee');

  lz = require('./lz-string.js');

  meta = require('./meta.coffee');

  event = require('./event.coffee');

  scrollManager = require('./scroll-manager.coffee');

  minicontent = require('./sp/minicontent.coffee');

  inarticleWidget = require('./widgets/inarticle.coffee');

  secretWidget = require('./widgets/secret.coffee');

  floatingWidget = require('./widgets/floating.coffee');

  infiniteFeedWidget = require('./widgets/infinite-feed.coffee');

  upDownWidget = require('./widgets/up-down.coffee');

  getFrameKeyBlacklist = function() {
    return ['width', 'height', 'widget_id', 'passback_url', 'passback_height'];
  };

  sendMessage = function(f, message) {
    return simplePostMessage.postMessage(message, f.getAttribute("src"), f.contentWindow);
  };

  postRequestToFrame = function(url, opts, target) {
    var _opt, form, hiddenField, i, key, key_blacklist, len, opt;
    key_blacklist = getFrameKeyBlacklist();
    form = document.createElement("form");
    form.setAttribute("method", "POST");
    form.setAttribute("action", url);
    form.setAttribute("target", target);
    form.setAttribute("data-dable_widget_el_id", opts.id);
    for (key in opts) {
      opt = opts[key];
      if ((opt == null) || indexOf.call(key_blacklist, key) >= 0) {
        continue;
      }
      if (util.isArray(opt)) {
        for (i = 0, len = opt.length; i < len; i++) {
          _opt = opt[i];
          hiddenField = document.createElement("input");
          hiddenField.setAttribute("type", "hidden");
          hiddenField.setAttribute("name", key);
          hiddenField.setAttribute("value", _opt);
          form.appendChild(hiddenField);
        }
      } else {
        hiddenField = document.createElement("input");
        hiddenField.setAttribute("type", "hidden");
        hiddenField.setAttribute("name", key);
        hiddenField.setAttribute("value", opt && typeof opt === "object" ? JSON.stringify(opt) : opt);
        form.appendChild(hiddenField);
      }
    }
    document.body.appendChild(form);
    return form.submit();
  };

  insertWiderplanetAd = function(opts) {
    var ad_el, category, el, height, protocol, width, zoneid;
    el = opts.el, width = opts.width, height = opts.height, zoneid = opts.zoneid, category = opts.category;
    protocol = location.protocol;
    ad_el = document.createElement("div");
    ad_el.style.textAlign = "center";
    ad_el.style.paddingTop = "5px";
    ad_el.innerHTML = "<iframe width=\"" + width + "\" height=\"" + height + "\" frameborder=\"0\" scrolling=\"no\"\nsrc=\"" + (util.protocol()) + "//adtg.widerplanet.com/delivery/wfr.php?zoneid=" + zoneid + "&category=" + category + "&cb=" + (Math.floor(Math.random() * 999999999)) + "&charset=UTF-8&loc=" + (escape(window.location)) + "&referer=" + (escape(util.getReferrer())) + "\")}\"></iframe>";
    return el.appendChild(ad_el);
  };

  insertAdsense = function(opts) {
    var ad_el, additional_style, auto, auto_opt, el, height, height_style, maxwidth, maxwidth_style, minwidth, minwidth_style, slotid, width, width_style;
    el = opts.el, minwidth = opts.minwidth, maxwidth = opts.maxwidth, width = opts.width, height = opts.height, slotid = opts.slotid, auto = opts.auto;
    if (adult.isAdultContent()) {
      return;
    }
    width_style = "";
    minwidth_style = "";
    maxwidth_style = "";
    height_style = "";
    auto_opt = "";
    if (width) {
      width_style = ";width:" + width + "px";
    }
    if (minwidth) {
      minwidth_style = ";min-width:" + minwidth + "px";
    }
    if (maxwidth) {
      maxwidth_style = ";max-width:" + maxwidth + "px";
    }
    if (height) {
      height_style = ";height:" + height + "px";
    }
    if (auto) {
      auto_opt = 'data-ad-format="auto"';
    }
    additional_style = "" + width_style + height_style + minwidth_style + maxwidth_style;
    ad_el = document.createElement("div");
    ad_el.style.textAlign = "center";
    ad_el.style.paddingTop = "5px";
    ad_el.innerHTML = "<!-- Dable 광고 -->\n<ins class=\"adsbygoogle\"\n   style=\"display:inline-block;" + additional_style + "\"\n   data-ad-client=\"ca-pub-1053900240830158\"\n   data-ad-slot=\"" + slotid + "\"\n   " + auto_opt + "></ins>\n<script>\n</script>";
    return el.appendChild(ad_el);
  };

  insertAdsenseLibrary = function() {
    var e, js2, js2_data;
    util.includeScript((util.protocol()) + "//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js");
    js2 = document.createElement("script");
    js2.type = "text/javascript";
    js2_data = "(adsbygoogle = window.adsbygoogle || []).push({});";
    try {
      js2.appendChild(document.createTextNode(js2_data));
    } catch (error) {
      e = error;
      js2.text = js2_data;
    }
    return document.body.appendChild(js2);
  };

  insertAdWidget = function(widget_id, el) {
    var new_el;
    new_el = document.createElement("div");
    new_el.id = "d-" + widget_id + "-" + (parseInt(Math.random() * 9999));
    new_el.style.padding = "5px 0";
    new_el.style.backgroundColor = "#fff";
    new_el.setAttribute("data-widget_id", widget_id);
    el.parentNode.insertBefore(new_el, el.nextSibling);
    return dable('renderWidget', new_el.id);
  };

  preparePassback = function(el, w, h, opts) {
    var passback_height, passback_url;
    passback_url = opts.passback_url, passback_height = opts.passback_height;
    return setTimeout(function() {
      var p;
      if ((el.getAttribute('data-ready')) === '1') {
        return;
      }
      p = document.createElement('iframe');
      p.allowTransparency = "true";
      p.width = w;
      p.height = passback_height || h;
      p.title = "추천 아이템";
      p.style.border = 0;
      p.frameBorder = '0';
      p.scrolling = 'no';
      p.src = passback_url;
      el.parentNode.appendChild(p);
      el.parentNode.removeChild(el);
      return p.parentNode.style.height = "auto";
    }, 3000);
  };

  insertFrame = function(el, url, w, h, opts) {
    var doInsertFrame, e, f, isWifi, key_blacklist, offsetY, param_method, ref, ref1, ref2, scrollY;
    key_blacklist = getFrameKeyBlacklist();
    param_method = typeof window !== "undefined" && window !== null ? (ref = window.location) != null ? (ref1 = ref.href) != null ? (ref2 = ref1.match(/[\?\&]dable=([^\#\&]+)/)) != null ? ref2[1] : void 0 : void 0 : void 0 : void 0;
    if (param_method) {
      opts.method = param_method;
    }
    opts.client_width = el.clientWidth;
    isWifi = util.isWifi();
    if (isWifi === true) {
      opts.network = 'wifi';
    } else if (isWifi === false) {
      opts.network = 'non-wifi';
    }
    opts.lang = util.getUserLanguage();
    scrollY = util.getScrollY();
    offsetY = util.getOffsetY(el);
    if (scrollY + 1500 > offsetY) {
      opts.pre_expose = 1;
    }
    if (window === window.top) {
      opts.is_top_win = 1;
    }
    try {
      top.window.location.href;
      opts.top_win_accessible = 1;
    } catch (error) {
      e = error;
    }
    f = document.createElement('iframe');
    f.allowTransparency = "true";
    f.width = w;
    f.height = h;
    f.title = "추천 아이템";
    f.style.border = 0;
    f.frameBorder = '0';
    f.scrolling = 'no';
    f.name = "dableframe-" + (Math.random());
    el.style.height = h + 'px';
    el.style.overflow = "hidden";
    el.innerHTML = '';
    el.appendChild(f);
    if ((opts != null ? opts.widget_id : void 0) === 'ZRoO16lm') {
      insertAdWidget('y74NAkXV', el);
    } else if ((opts != null ? opts.widget_id : void 0) === '3xXAO07G') {
      if (Math.random() > .5) {
        insertAdWidget('OoRxD0ly', el);
      } else {
        insertAdWidget('ml6EJ074', el);
      }
    } else if ((opts != null ? opts.widget_id : void 0) === 'AOoRE6Xy') {
      insertWiderplanetAd({
        category: "thesingle",
        el: el,
        width: 250,
        height: 250,
        zoneid: "20088"
      });
    } else if ((opts != null ? opts.widget_id : void 0) === 'A6o3APlZ') {
      insertAdWidget('ml6OBrX4', el);
    } else if ((opts != null ? opts.widget_id : void 0) === 'VPl15LlE') {
      insertAdWidget('1oVxnLlP', el);
    } else if ((opts != null ? opts.widget_id : void 0) === 'A370BMXx') {
      if (Math.random() > .5) {
        insertAdWidget('37JAOboN', el);
      } else {
        insertAdWidget('Alm3dEo1', el);
      }
    } else if ((opts != null ? opts.widget_id : void 0) === 'wBoxeG78') {
      insertAdWidget('6XgYNV7N', el);
    } else if ((opts != null ? opts.widget_id : void 0) === 'A1XDRG7e') {
      insertAdsense({
        el: el,
        minwidth: 320,
        maxwidth: 732,
        height: 90,
        slotid: "1516665626",
        auto: true
      });
      insertAdsenseLibrary();
    } else if ((opts != null ? opts.widget_id : void 0) === 'V7a4VKoB') {
      insertAdsense({
        el: el,
        width: 677,
        height: 90,
        slotid: "7321339225",
        auto: true
      });
      insertAdsenseLibrary();
    } else if ((opts != null ? opts.widget_id : void 0) === '2o2vBJoe') {
      if (Math.random() > .5) {
        insertAdsense({
          el: el,
          width: 320,
          height: 100,
          slotid: "8798072422",
          auto: true
        });
        insertAdsenseLibrary();
      } else {
        insertAdWidget('OoR8Lely', el);
      }
    } else if ((opts != null ? opts.widget_id : void 0) === 'qAlmxE71') {
      insertAdsense({
        el: el,
        width: 640,
        height: 90,
        slotid: "7467502826",
        auto: true
      });
      insertAdsenseLibrary();
    } else if ((opts != null ? opts.widget_id : void 0) === 'y74QqdlV') {
      insertAdWidget('57w1eQX8', el);
    } else if ((opts != null ? opts.widget_id : void 0) === 'VPl10K7E') {
      insertAdWidget('6oMgVGlb', el);
    } else if ((opts != null ? opts.widget_id : void 0) === 'QXekMV7e') {
      insertAdWidget('M7N4EmXb', el);
    }
    doInsertFrame = function() {
      var _opt, get_param, i, key, len, opt;
      get_param = "?";
      for (key in opts) {
        opt = opts[key];
        if ((opt == null) || indexOf.call(key_blacklist, key) >= 0) {
          continue;
        }
        if (util.isArray(opt)) {
          for (i = 0, len = opt.length; i < len; i++) {
            _opt = opt[i];
            if (get_param !== "?") {
              get_param += "&";
            }
            get_param += (encodeURIComponent(key)) + "=" + (encodeURIComponent(_opt));
          }
        } else {
          if (typeof opt === "object") {
            opt = JSON.stringify(opt);
          }
          if (get_param !== "?") {
            get_param += "&";
          }
          get_param += (encodeURIComponent(key)) + "=" + (encodeURIComponent(opt));
        }
      }
      if (get_param.length <= 2000) {
        url += get_param;
        f.src = url;
        if (opts.passback_url) {
          preparePassback(f, w, h, opts);
        }
      } else {
        postRequestToFrame(url, opts, f.name);
        f.setAttribute('data-org_src', url);
      }
    };
    return doInsertFrame();
  };

  getFrame = function(id) {
    var e, f, frame, i, len, ref;
    frame = null;
    try {
      frame = document.getElementById(id).getElementsByTagName("iframe")[0];
    } catch (error) {
      e = error;
      ref = document.getElementsByTagName("iframe");
      for (i = 0, len = ref.length; i < len; i++) {
        f = ref[i];
        if (f.src.indexOf("/widgets/id/") > -1) {
          frame = f;
        }
      }
    }
    return frame;
  };

  setFrameHeight = function(id, h) {
    var el, frame;
    frame = getFrame(id);
    if (frame != null) {
      frame.height = h;
    }
    if (document.getElementById(id)) {
      el = document.getElementById(id);
      return el.style.height = "auto";
    }
  };

  setFrameTitle = function(id, title) {
    var frame;
    frame = getFrame(id);
    return frame != null ? frame.title = title : void 0;
  };

  isIECompatabilityMode = (function() {
    var ua;
    ua = window.navigator.userAgent;
    if ((ua != null ? ua.indexOf("MSIE 7.0") : void 0) > -1 && /Trident\/[4567]\.0/.test(ua)) {
      return true;
    } else {
      return false;
    }
  })();

  onReady = function(fid) {
    var f, send, test_s_names;
    f = getFrame(fid);
    f.setAttribute('data-ready', '1');
    test_s_names = [];
    send = function(eventType) {
      var offset;
      if (f != null ? f.contentWindow : void 0) {
        offset = util.getOffset(f);
        return sendMessage(f, eventType + "=" + ((offset != null ? offset.x : void 0) || 0) + "," + ((offset != null ? offset.y : void 0) || 0));
      }
    };
    if (test_s_names.indexOf(this.dable.q.executor.service_name) > -1) {
      scrollManager.listenByElement({
        targetElement: f.parentNode,
        method: function(scrollY) {
          if (scrollY !== null) {
            return send("expose");
          }
        },
        offsetY: f.parentNode.offsetHeight / 2,
        reregisterIntervalMs: 5000 + parseInt(Math.random() * 500, 10),
        isWatchWithTimer: true
      });
    } else {
      scrollManager.listenByElement({
        targetElement: f.parentNode,
        method: function(scrollY) {
          if (scrollY !== null) {
            return send("expose");
          }
        },
        offsetY: 200,
        reregisterIntervalMs: 5000 + parseInt(Math.random() * 500, 10),
        isWatchWithTimer: false
      });
    }
    return scrollManager.listenByElement({
      targetElement: f.parentNode,
      method: function() {
        return send("pre_expose");
      },
      offsetY: -1000,
      reregisterIntervalMs: 5000 + parseInt(Math.random() * 500, 10),
      isWatchWithTimer: false
    });
  };

  dable_popup_id = "d-popup-" + (parseInt(Math.random() * 999999));

  showDablePopup = function(arg) {
    var ads, en, h, innerHTML, introduction_page, introduction_title, is_geniee, lang, new_el, new_el2, new_el3, ref, ref1, ref2, ref3, ref4, ref5, ref6, service_id, src, uid, w, widget_id, wrapped;
    uid = (ref = arg.uid) != null ? ref : '', service_id = (ref1 = arg.service_id) != null ? ref1 : '', widget_id = (ref2 = arg.widget_id) != null ? ref2 : '', ads = (ref3 = arg.ads) != null ? ref3 : '', is_geniee = (ref4 = arg.is_geniee) != null ? ref4 : false;
    if (document.getElementById(dable_popup_id)) {
      return;
    }
    w = window.innerWidth || ((ref5 = document.documentElement) != null ? ref5.clientWidth : void 0) || ((ref6 = document.body) != null ? ref6.clientWidth : void 0);
    if (w >= 680) {
      w = 680;
      h = 606;
    } else {
      w = 320;
      h = 470;
    }
    lang = util.getFullUserLanguage().toLowerCase();
    if (is_geniee) {
      introduction_page = "introduction_geniee_ja.html";
      introduction_title = 'Genieeが提供するレコメンドについて';
    } else if (lang.substr(0, 2) === "ko") {
      introduction_page = "introduction.html";
      introduction_title = 'Dable 소개';
    } else if (lang === "zh-tw" || lang.substr(0, 7) === "zh-hant") {
      introduction_page = "introduction_zh-tw.html";
      introduction_title = 'Dable 简介';
    } else if (lang.substr(0, 2) === "zh") {
      introduction_page = "introduction_zh-cn.html";
      introduction_title = 'Dable 簡介';
    } else if (lang.substr(0, 2) === "ja") {
      introduction_page = "introduction_ja.html";
      introduction_title = 'Dableの紹介';
    } else if (lang.substr(0, 2) === "id") {
      introduction_page = "introduction_id.html";
      introduction_title = 'Pengenalan Dable';
    } else if (lang.substr(0, 2) === "vi") {
      introduction_page = "introduction_vi.html";
      introduction_title = 'giới thiệu Dable';
    } else {
      introduction_page = "introduction_en.html";
      introduction_title = 'Dable introduction';
    }
    en = encodeURIComponent;
    wrapped = window.self !== window.top;
    src = (util.protocol()) + "//static.dable.io/static/html/" + introduction_page + "?from=" + (en(window.location.href)) + "&uid=" + (en(uid)) + "&service_id=" + (en(service_id)) + "&widget_id=" + (en(widget_id)) + "&wrapped=" + wrapped + "&ads=" + (en(ads));
    innerHTML = "<iframe src=" + src + " title='" + introduction_title + "' width='" + w + "' height='" + h + "' frameborder='0' scrolling='yes' ></iframe>";
    if (wrapped) {
      return window.open(src, "Dable");
    } else {
      new_el = document.createElement("div");
      new_el.id = dable_popup_id;
      new_el.style.position = "fixed";
      new_el.style.zIndex = "99999999";
      new_el.style.top = "0";
      new_el.style.right = "0";
      new_el.style.bottom = "0";
      new_el.style.left = "0";
      new_el.style.WebkitOverflowScrolling = "touch";
      new_el.style.textAlign = "center";
      new_el2 = document.createElement("div");
      new_el2.style.position = "fixed";
      new_el2.style.top = "0";
      new_el2.style.right = "0";
      new_el2.style.bottom = "0";
      new_el2.style.left = "0";
      new_el2.style.backgroundColor = "#000";
      new_el2.style.opacity = ".8";
      new_el2.style.filter = 'alpha(opacity=80)';
      new_el2.onclick = closeDablePopup;
      new_el3 = document.createElement("div");
      new_el3.style.position = "absolute";
      new_el3.style.top = "50%";
      new_el3.style.left = "50%";
      new_el3.style.margin = "-" + (h / 2) + "px 0 0 -" + (w / 2) + "px";
      new_el3.style.width = w + "px";
      new_el3.style.height = h + "px";
      new_el3.style.borderRadius = "8px";
      new_el3.style.WebkitOverflowScrolling = "touch";
      new_el3.style.overflowY = "scroll";
      new_el3.style.overflowX = "hidden";
      new_el3.innerHTML = innerHTML;
      new_el.appendChild(new_el2);
      new_el.appendChild(new_el3);
      return document.body.appendChild(new_el);
    }
  };

  closeDablePopup = function() {
    if (document.getElementById(dable_popup_id)) {
      return document.body.removeChild(document.getElementById(dable_popup_id));
    }
  };

  auto_val = {};

  pubsub.subscribe('service_name', function(sname) {
    return auto_val.service_name = sname;
  });

  pubsub.subscribe('item_ids', function(item_ids) {
    return auto_val.item_ids = item_ids;
  });

  pubsub.subscribe('qterm', function(qterm) {
    return auto_val.qterm = qterm;
  });

  widgets = {};

  Widget = (function() {
    function Widget(dom_id, cid, uid, item_ids, options, callback) {
      if (options == null) {
        options = {};
      }
      this.render_widget = bind(this.render_widget, this);
      if (!dom_id) {
        return util.debug("dom id is required but empty");
      }
      this.cid = cid;
      this.uid = uid;
      this.widget_render_tried = 0;
      this.fetch_widget_prefs(dom_id, options, (function(_this) {
        return function(el, opts) {
          widgets[dom_id] = {
            item_ids: item_ids,
            loaded_callback: callback
          };
          return _this.render_widget(dom_id, el, opts, item_ids);
        };
      })(this));
    }

    Widget.prototype.fetch_widget_prefs = function(dom_id, user_opts, callback) {
      var el, item, opts, service_name, widget_opts, widget_opts_lz;
      widget_opts = function(attr_name, option) {
        var cut, default_val, opts_obj, ref, val;
        if (option == null) {
          option = {};
        }
        default_val = option.default_val, cut = option.cut, opts_obj = (ref = option.opts_obj) != null ? ref : opts;
        if (user_opts[attr_name] != null) {
          val = user_opts[attr_name];
        } else if (util.attr(el, "data-" + attr_name)) {
          val = util.attr(el, "data-" + attr_name);
        } else if (default_val) {
          val = default_val;
        }
        if (cut && val) {
          return opts_obj[attr_name] = val.substr(0, cut);
        } else if (val) {
          return opts_obj[attr_name] = val;
        }
      };
      opts = {};
      el = document.getElementById(dom_id);
      if (el) {
        widget_opts('widget_id');
      }
      service_name = user_opts.service_name || auto_val.service_name;
      if ((el == null) || (!service_name && !opts.widget_id)) {
        return setTimeout((function(_this) {
          return function() {
            if (++_this.widget_render_tried > 10) {
              return util.debug("renderWidget found no DOM for this ID selector : " + dom_id);
            }
            return _this.fetch_widget_prefs(dom_id, user_opts, callback);
          };
        })(this), 50);
      }
      opts.from = window.location.href;
      opts.url = user_opts.url || window.location.href;
      opts.ref = user_opts.ref || util.getReferrer();
      opts.cid = this.cid;
      opts.uid = this.uid;
      opts.passback_url = user_opts.passback_url;
      opts.passback_height = user_opts.passback_height;
      if (service_name) {
        opts.site = service_name;
      }
      widget_opts_lz = function(attr_name, option) {
        widget_opts(attr_name, option);
        if (opts[attr_name]) {
          opts[attr_name + "_lz"] = lz.compressToEncodedURIComponent(opts[attr_name]);
          return delete opts[attr_name];
        }
      };
      if (user_opts.test) {
        opts.test = 1;
      }
      if (user_opts.shows_preview_slot_index) {
        opts.shows_preview_slot_index = 1;
      }
      if (user_opts.option_json) {
        opts.option_json = user_opts.option_json;
      }
      if (user_opts.ad_info) {
        opts.ad_info = JSON.stringify(user_opts.ad_info);
      }
      opts.id = dom_id;
      widget_opts('width', {
        default_val: '100%'
      });
      widget_opts('height', {
        default_val: '0'
      });
      widget_opts('ad_position');
      widget_opts('widget_type1');
      widget_opts('widget_type2');
      widget_opts('widget_type3');
      widget_opts('has_outline');
      widget_opts('text_align');
      widget_opts('title_type');
      widget_opts('title_type1');
      widget_opts('title_type2');
      widget_opts('title_type3');
      widget_opts('title_img');
      widget_opts('title_img1');
      widget_opts('title_img2');
      widget_opts('title_img3');
      widget_opts_lz('title_text');
      widget_opts_lz('title_text1');
      widget_opts_lz('title_text2');
      widget_opts_lz('title_text3');
      widget_opts('title_size');
      widget_opts('title_size1');
      widget_opts('title_size2');
      widget_opts('title_size3');
      widget_opts('has_thumbnail');
      widget_opts('page_count');
      widget_opts('type');
      widget_opts('item_count');
      widget_opts('item_size');
      widget_opts('row_count');
      widget_opts('line_color');
      widget_opts('item_color');
      widget_opts('price_color');
      widget_opts('price_size');
      widget_opts('has_price');
      widget_opts('published_time_color');
      widget_opts('published_time_size');
      widget_opts('published_time_format');
      widget_opts('has_published_time');
      widget_opts('random');
      widget_opts('channel_prefix');
      widget_opts('channel');
      widget_opts('infinite_scroll');
      widget_opts('autoswipe_seconds');
      widget_opts('promotions');
      widget_opts('floating');
      widget_opts('sliding');
      widget_opts('inarticle');
      widget_opts('custom_css');
      widget_opts('self_type');
      widget_opts('self_title_type');
      widget_opts('self_title_img');
      widget_opts('self_title_text');
      widget_opts('self_title_size');
      widget_opts('has_dable_logo');
      widget_opts('abtest_index');
      widget_opts('nolink');
      widget_opts('item_props_order');
      widget_opts('ad_campaign_id');
      widget_opts('ad_request_id');
      widget_opts('ad_content_id');
      widget_opts('ad_response_method');
      widget_opts('additional_ad_clicklog');
      widget_opts('ad_clicklog');
      widget_opts('opt_out');
      widget_opts('inventory_id');
      item = meta.read_item(['category1', 'category2', 'category3']);
      if (item.category1) {
        opts.category1 = item.category1;
      }
      if (item.category2) {
        opts.category2 = item.category2;
      }
      if (item.category3) {
        opts.category3 = item.category3;
      }
      widget_opts('best_type');
      widget_opts('category_level');
      widget_opts('category1', {
        cut: 64
      });
      widget_opts('category2', {
        cut: 64
      });
      widget_opts('category3', {
        cut: 64
      });
      widget_opts('iframe-src');
      widget_opts('iframe-width');
      widget_opts('iframe-height');
      widget_opts('ad_mark_test');
      widget_opts('force_karamel_ad_mock');
      opts.ad_params = {};
      widget_opts('gn_ext', {
        opts_obj: opts.ad_params
      });
      widget_opts('gn_efp', {
        opts_obj: opts.ad_params
      });
      widget_opts('gn_uids', {
        opts_obj: opts.ad_params
      });
      widget_opts('gn_zids', {
        opts_obj: opts.ad_params
      });
      widget_opts('is_bridge');
      widget_opts('bridge_item_id');
      return callback(el, opts);
    };

    Widget.prototype.fetch_widget_items = function(el, item_ids, retry, callback) {
      if (retry == null) {
        retry = true;
      }
      item_ids = item_ids || util.attr(el, 'data-item_id') || auto_val.item_ids;
      if ((item_ids == null) && retry) {
        return setTimeout((function(_this) {
          return function() {
            if (typeof retry === "number") {
              retry--;
            }
            return _this.fetch_widget_items(el, item_ids, retry, callback);
          };
        })(this), 200);
      }
      if (!util.isArray(item_ids)) {
        item_ids = [item_ids];
      }
      return callback(item_ids);
    };

    Widget.prototype.render_widget = function(dom_id, el, opts, set_item_ids) {
      return this.fetch_widget_items(el, set_item_ids, false, (function(_this) {
        return function(item_ids) {
          var widget_url;
          if (item_ids.length > 1) {
            item_ids = [item_ids[parseInt(Math.random() * item_ids.length)]];
          }
          opts.item_id = item_ids[0];
          if (util.readParam('dable_campaign_id')) {
            opts.test_campaign_id = util.readParam('dable_campaign_id');
            opts.nolog = 1;
          }
          if (util.readParam('dable_noad')) {
            opts.nodablead = util.readParam('dable_noad');
          }
          if (opts.bridge_item_id) {
            widget_url = ((util.protocol()) + "//" + (util.api_server_domain())) + ("/bridge/services/" + (encodeURIComponent(opts.site)) + "/item/" + (encodeURIComponent(opts.bridge_item_id)));
          } else if (opts.widget_id) {
            widget_url = ((util.protocol()) + "//" + (util.api_server_domain())) + ("/widgets/id/" + opts.widget_id) + (opts.uid && ("/users/" + opts.uid) || "");
          } else if (opts.site) {
            widget_url = ((util.protocol()) + "//" + (util.api_server_domain())) + ("/widgets/services/" + (encodeURIComponent(opts.site))) + (opts.uid && ("/users/" + opts.uid) || "");
          } else {
            util.debug("one of widget_id or service_name is required but empty");
            return;
          }
          opts.pixel_ratio = window.devicePixelRatio || 1;
          return insertFrame(el, widget_url, opts.width, opts.height, opts);
        };
      })(this));
    };

    return Widget;

  })();

  simplePostMessage.receiveMessage(function(e) {
    var _f, bridge_item_id, cont_id, e2, el, el_id, error_msg, f, fid, h, has_recom, i, is_bridge_frame, is_secret_widget, len, p, page, readProp, received_data, ref, ref1, ref2, results, t;
    readProp = function(msg, prop) {
      var ref;
      return ((ref = msg.match(new RegExp("^.*" + prop + "=([^\&]+).*$"))) != null ? ref[1] : void 0) || null;
    };
    if (e.data && typeof e.data === "string") {
      try {
        received_data = decodeURIComponent(e.data);
      } catch (error) {
        e2 = error;
        received_data = e.data;
      }
      if (received_data.indexOf('show_dable_popup=1') > -1) {
        showDablePopup({
          uid: readProp(received_data, 'uid'),
          service_id: readProp(received_data, 'service_id'),
          is_geniee: readProp(received_data, 'is_geniee') === '1',
          widget_id: readProp(received_data, 'widget_id'),
          ads: readProp(received_data, 'ads')
        });
      } else if (received_data.indexOf('close_dable_popup=1') > -1) {
        closeDablePopup();
      }
      if (received_data.indexOf('show_minicontent=') > -1) {
        p = readProp(received_data, 'show_minicontent').split("--");
        minicontent.show({
          campaign_id: p[0],
          content_id: p[1],
          service_name: p[3],
          is_mobile: util.isMobileDevice()
        });
      }
      if (received_data.indexOf('close_minicontent=1') > -1) {
        minicontent.close();
      }
      if (received_data.indexOf('on_bridge_item_clicked=') > -1) {
        bridge_item_id = readProp(received_data, 'on_bridge_item_clicked');
        is_bridge_frame = (typeof window !== "undefined" && window !== null ? (ref = window.location) != null ? (ref1 = ref.pathname) != null ? ref1.indexOf('/bridge/services') : void 0 : void 0 : void 0) > -1;
        if (is_bridge_frame) {
          simplePostMessage.postMessage("on_bridge_item_clicked=" + bridge_item_id, '*');
        } else {
          window.location.hash = "#dable_bridge_item=" + bridge_item_id;
        }
      }
      fid = readProp(received_data, 'id');
      if (!fid) {
        return;
      }
      if (received_data.indexOf('init=') > -1) {
        onReady(fid);
      }
      if (received_data.indexOf('check_and_page_expose=1') > -1) {
        _f = getFrame(fid);
        if ((_f != null ? _f.contentWindow : void 0) && scrollManager.isElWithinOffsetY({
          targetElement: _f.parentNode,
          offsetY: 200
        })) {
          page = readProp(received_data, 'page');
          sendMessage(_f, "page_expose=" + page);
        }
      }
      if (received_data.indexOf('block_content=') > -1) {
        _f = getFrame(fid);
        if (_f != null ? _f.contentWindow : void 0) {
          cont_id = readProp(received_data, 'block_content');
          sendMessage(_f, "block_content=" + cont_id);
        }
      }
      if (received_data.indexOf('floating=') > -1) {
        f = readProp(received_data, 'floating');
        try {
          f = JSON.parse(f);
          floatingWidget.init(fid, f);
        } catch (error) {
          e = error;
        }
      }
      if (received_data.indexOf('is_updown_widget=') > -1) {
        upDownWidget.init({
          frame_id: fid,
          link_widget_id: readProp(received_data, 'link_widget'),
          threshold_top: Number(readProp(received_data, 'threshold_top')) || 40,
          threshold_bottom: Number(readProp(received_data, 'threshold_bottom')) || 30
        });
      }
      is_secret_widget = false;
      if (received_data.indexOf('sliding=') > -1) {
        f = readProp(received_data, 'sliding');
        try {
          f = JSON.parse(f);
          is_secret_widget = secretWidget.init(fid, f);
        } catch (error) {
          e = error;
        }
      }
      if (received_data.indexOf('is_infinite_feed=') > -1) {
        infiniteFeedWidget.init(fid, Number(readProp(received_data, 'infinite_feed_scroll_amount')));
      }
      if (received_data.indexOf('if_height=') > -1) {
        h = Number(readProp(received_data, 'if_height'));
        if (!isNaN(h) && h > 0) {
          setFrameHeight(fid, h);
        }
      }
      if (received_data.indexOf('need_inarticle_init=') > -1) {
        inarticleWidget.init(fid, JSON.parse(readProp(received_data, 'need_inarticle_init')));
      }
      if (received_data.indexOf('error=') > -1) {
        error_msg = readProp(received_data, 'error');
        return util.debug(error_msg);
      }
      if (received_data.indexOf('title=') > -1) {
        t = readProp(received_data, 'title');
        setFrameTitle(fid, t);
      }
      if (received_data.indexOf('has_recom') > -1) {
        has_recom = Number(readProp(received_data, 'has_recom')) === 1;
        if (widgets[fid] && widgets[fid].loaded_callback) {
          widgets[fid].loaded_callback(has_recom);
        }
      }
      if (received_data.indexOf('close_dable_widget') > -1) {
        el_id = readProp(received_data, 'id');
        if (el_id && (el = document.getElementById(el_id))) {
          ref2 = el.childNodes;
          results = [];
          for (i = 0, len = ref2.length; i < len; i++) {
            f = ref2[i];
            results.push(f.style.display = 'none');
          }
          return results;
        }
      }
    }
  });

  module.exports = Widget;


  },{"./JSON":3,"./JSONP.coffee":4,"./adult.coffee":6,"./ba-postmessage.js":8,"./event.coffee":12,"./lz-string.js":15,"./meta.coffee":17,"./pubsub.coffee":18,"./scroll-manager.coffee":20,"./sp/minicontent.coffee":21,"./util.coffee":22,"./widgets/floating.coffee":24,"./widgets/inarticle.coffee":25,"./widgets/infinite-feed.coffee":26,"./widgets/secret.coffee":27,"./widgets/up-down.coffee":28}],24:[function(require,module,exports){
  var event, init, util, widgetScrollEvents, widgetScrollEventsShow, widgetScrollEventsTid;

  util = require('../util.coffee');

  event = require('../event.coffee');

  widgetScrollEvents = {};

  widgetScrollEventsTid = {};

  widgetScrollEventsShow = {};

  init = function(id, options) {
    var appearWidget, appear_set, check, close_btn, el, h, h_hidden, ref, v;
    if (!(options != null ? options.enabled : void 0)) {
      return;
    }
    el = document.getElementById(id);
    if (el.getAttribute('data-dable-floating') === '1') {
      return;
    }
    el.setAttribute('data-dable-floating', '1');
    el.style.width = options.width + "px";
    el.style.position = "fixed";
    el.style.zIndex = "99999999";
    appear_set = (ref = options.appear) === 'top' || ref === 'bottom';
    v = (options.vmargin || 0) + "px";
    h = (options.hmargin || 0) + "px";
    h_hidden = "-" + (Number(options.width) + 50) + "px";
    switch (options.position) {
      case "bottomright":
        el.style.bottom = v;
        el.style.right = appear_set ? h_hidden : h;
        el.style.transition = "0.3s ease-in";
        break;
      case "bottomleft":
        el.style.bottom = v;
        el.style.left = appear_set ? h_hidden : h;
        el.style.transition = "0.3s ease-in";
        break;
      case "bottomcenter":
        h_hidden = "9999px";
        el.style.left = "50%";
        el.style.bottom = v;
        el.style.marginLeft = appear_set ? h_hidden : "-" + (options.width / 2) + "px";
        break;
      case "topright":
        el.style.top = v;
        el.style.right = appear_set ? h_hidden : h;
        el.style.transition = "0.3s ease-in";
        break;
      case "topleft":
        el.style.top = v;
        el.style.left = appear_set ? h_hidden : h;
        el.style.transition = "0.3s ease-in";
        break;
      case "topcenter":
        h_hidden = "9999px";
        el.style.left = "50%";
        el.style.top = v;
        el.style.marginLeft = appear_set ? h_hidden : "-" + options.width + "px";
    }
    if (appear_set) {
      if (el.getElementsByTagName("i").length === 0) {
        close_btn = document.createElement("i");
        close_btn.style.position = "absolute";
        close_btn.style.top = "-7px";
        close_btn.style.right = "-7px";
        close_btn.style.width = "16px";
        close_btn.style.height = "16px";
        close_btn.style.margin = 0;
        close_btn.style.padding = 0;
        close_btn.style.border = 0;
        close_btn.style.background = "url(" + (util.protocol()) + "//api.dable.io/static/i/x.png) no-repeat 0 0";
        close_btn.style.cursor = "pointer";
        close_btn.onclick = function(e) {
          appearWidget(false);
          return setTimeout(function() {
            return el.style.display = "none";
          }, 200);
        };
        el.appendChild(close_btn);
      }
      appearWidget = function(show) {
        if (show) {
          switch (options.position) {
            case "bottomright":
            case "topright":
              return el.style.right = h;
            case "bottomleft":
            case "topleft":
              return el.style.left = h;
            case "bottomcenter":
            case "topcenter":
              return el.style.marginLeft = h;
          }
        } else {
          switch (options.position) {
            case "bottomright":
            case "topright":
              return el.style.right = h_hidden;
            case "bottomleft":
            case "topleft":
              return el.style.left = h_hidden;
            case "bottomcenter":
            case "topcenter":
              return el.style.marginLeft = h_hidden;
          }
        }
      };
      if (widgetScrollEvents[id]) {
        event.removeEvent(util.get_scroll_base_el(), "scroll", widgetScrollEvents[id]);
      }
      check = function() {
        var old, ref1, ref2, show, wh, wy;
        old = widgetScrollEventsShow[id];
        wy = util.getScrollY();
        wh = util.getHeight();
        if (options.appear === 'top' && ((ref1 = options.position) === 'topright' || ref1 === 'topleft')) {
          show = options.appear_px <= wy;
        } else if (options.appear === 'top') {
          show = options.appear_px <= wy + wh.viewport;
        } else if (options.appear === 'bottom' && ((ref2 = options.position) === 'bottomright' || ref2 === 'bottomleft')) {
          show = options.appear_px >= wh.window - wh.viewport - wy;
        } else if (options.appear === 'bottom') {
          show = options.appear_px >= wh.window - wh.viewport - wy;
        }
        if (show !== old) {
          appearWidget(show);
          widgetScrollEventsShow[id] = show;
        }
        return widgetScrollEventsTid[id] = null;
      };
      widgetScrollEvents[id] = function() {
        if (widgetScrollEventsTid[id]) {
          clearTimeout(widgetScrollEventsTid[id]);
        }
        return widgetScrollEventsTid[id] = setTimeout(check, 100);
      };
      event.addEvent(util.get_scroll_base_el(), "scroll", widgetScrollEvents[id]);
      widgetScrollEventsShow[id] = null;
      return check();
    }
  };

  module.exports = {
    init: init
  };


  },{"../event.coffee":12,"../util.coffee":22}],25:[function(require,module,exports){
  var checkEnoughTextAfterEl, findTargetNode, init, injectPlaceholder, read_body, read_body_el, ref, specialTagsBlockText;

  ref = require('../meta.coffee'), read_body = ref.read_body, read_body_el = ref.read_body_el;

  specialTagsBlockText = ['img', 'iframe', 'figure'];

  checkEnoughTextAfterEl = function(el, t) {
    var has_special_tags, j, k, len, len1, ref1, tag;
    if (t == null) {
      t = "";
    }
    t += (el != null ? (ref1 = el.innerHTML) != null ? ref1.toLowerCase() : void 0 : void 0) || el.textContent;
    has_special_tags = false;
    for (j = 0, len = specialTagsBlockText.length; j < len; j++) {
      tag = specialTagsBlockText[j];
      if (t.indexOf("<" + tag) > -1) {
        has_special_tags = true;
        break;
      }
    }
    while (t.indexOf('<script') > -1) {
      t = t.substr(0, t.indexOf('<script')) + t.substr(t.indexOf('<\/script>') + 9);
    }
    while (t.indexOf('<style') > -1) {
      t = t.substr(0, t.indexOf('<style')) + t.substr(t.indexOf('<\/style>') + 8);
    }
    for (k = 0, len1 = specialTagsBlockText.length; k < len1; k++) {
      tag = specialTagsBlockText[k];
      t = t.replace(new RegExp("<" + tag + "(.|[\r\n])*"), '');
    }
    t = t.replace(/<[^>]+>/g, '').replace(/^\s+/, '').replace(/\s+$/, '');
    if (t.length > 150) {
      return true;
    } else if (!t.length) {
      return false;
    } else if (!has_special_tags && (el != null ? el.nextSibling : void 0)) {
      return checkEnoughTextAfterEl(el.nextSibling, t);
    } else {
      return false;
    }
  };

  findTargetNode = function(arg) {
    var _el, el, i, l, pos_rate, target_node_idx;
    el = arg.el, l = arg.l, pos_rate = arg.pos_rate;
    target_node_idx = Math.floor(l * pos_rate / 100) - 1 || l - 1;
    if (checkEnoughTextAfterEl(el.childNodes[target_node_idx])) {
      return el.childNodes[target_node_idx];
    }
    i = 0;
    while (i++ < l) {
      if (target_node_idx + i < l) {
        _el = el.childNodes[target_node_idx + i];
        if (_el && checkEnoughTextAfterEl(_el)) {
          return _el;
        }
      }
      if (target_node_idx - i >= 0) {
        _el = el.childNodes[target_node_idx - i];
        if (_el && checkEnoughTextAfterEl(_el)) {
          return _el;
        }
      }
    }
    return false;
  };

  injectPlaceholder = function(el, arg) {
    var e, innerCss, l, l2, placeholder, pos_rate, ref1, style, target_node;
    pos_rate = arg.pos_rate;
    if (!el || !((ref1 = el.childNodes) != null ? ref1.length : void 0)) {
      return null;
    }
    l = el.childNodes.length;
    l2 = el.children.length;
    if (l <= 3 && l2 === 1) {
      return injectPlaceholder(el.children[0], {
        pos_rate: pos_rate
      });
    }
    target_node = findTargetNode({
      el: el,
      l: l,
      pos_rate: pos_rate
    });
    if (!target_node) {
      return false;
    }
    placeholder = document.createElement("div");
    placeholder.className = "dable_placeholder";
    style = document.createElement("style");
    innerCss = "@media all and (min-width: 1px) and (max-width: 450px) { .dable_placeholder{ width: 100% !important; padding: 10px 0 !important; }}";
    try {
      style.innerText = innerCss;
    } catch (error) {
      e = error;
      style.cssText = innerCss;
    }
    placeholder.appendChild(style);
    el.insertBefore(placeholder, target_node);
    return placeholder;
  };

  init = function(id, arg) {
    var body_el, el, enabled, float, form, frame, is_wzt_by_post, j, len, new_hidden_field, pel, pos_rate, ref1, ref2, width, wzt_post_form;
    enabled = arg.enabled, float = arg.float, width = arg.width, pos_rate = (ref1 = arg.pos_rate) != null ? ref1 : 50;
    if (!enabled) {
      return;
    }
    body_el = read_body_el();
    if (!body_el) {
      return;
    }
    el = document.getElementById(id);
    pel = body_el.querySelector('.dable_placeholder');
    if (!pel) {
      pel = injectPlaceholder(body_el, {
        pos_rate: pos_rate
      });
    }
    if (!pel) {
      return;
    }
    if (float === 'left') {
      pel.style.float = float;
      pel.style.padding = "10px 15px 10px 0";
    } else if (float === 'right') {
      pel.style.float = float;
      pel.style.padding = "10px 0 10px 15px";
    } else {
      pel.style.margin = "0 auto";
      pel.style.padding = "10px 0";
    }
    pel.style.width = width + "%";
    frame = el.getElementsByTagName('iframe')[0];
    is_wzt_by_post = !frame.src;
    if (is_wzt_by_post) {
      ref2 = document.getElementsByTagName('form');
      for (j = 0, len = ref2.length; j < len; j++) {
        form = ref2[j];
        if (id === form.getAttribute('data-dable_widget_el_id')) {
          wzt_post_form = form;
          new_hidden_field = document.createElement("input");
          new_hidden_field.setAttribute("type", "hidden");
          new_hidden_field.setAttribute("name", "inarticle_init");
          new_hidden_field.setAttribute("value", "1");
          wzt_post_form.appendChild(new_hidden_field);
          break;
        }
      }
    } else {
      frame.src = frame.src + '&inarticle_init=1';
    }
    el.parentNode.removeChild(el);
    pel.appendChild(el);
    if (wzt_post_form) {
      return wzt_post_form.submit();
    }
  };

  module.exports = {
    init: init
  };


  },{"../meta.coffee":17}],26:[function(require,module,exports){
  var event, init, loadFeed, simplePostMessage, util, widgetScrollEvents, widgetScrollEventsTid;

  event = require('../event.coffee');

  simplePostMessage = require('../ba-postmessage.js');

  util = require('../util.coffee');

  widgetScrollEvents = {};

  widgetScrollEventsTid = {};

  loadFeed = function(el) {
    var f, ref;
    f = (ref = el.getElementsByTagName("iframe")) != null ? ref[0] : void 0;
    if (f != null ? f.contentWindow : void 0) {
      return simplePostMessage.postMessage("load_infinite_feed", f.getAttribute("src") || f.getAttribute('data-org_src'), f.contentWindow);
    }
  };

  init = function(id, scroll_amount) {
    var _checked, _scroll_count, check, el;
    el = document.getElementById(id);
    if (widgetScrollEvents["ifeed" + id]) {
      event.removeEvent(util.get_scroll_base_el(), "scroll", widgetScrollEvents["ifeed" + id]);
    }
    _checked = false;
    _scroll_count = 0;
    check = function() {
      if (_checked || (scroll_amount > -1 && scroll_amount <= _scroll_count + 1)) {
        return;
      }
      _checked = true;
      setTimeout((function() {
        _checked = false;
        return check();
      }), 100);
      if (util.isScrollBottom(el, 200)) {
        _scroll_count++;
        return loadFeed(el);
      }
    };
    event.addEvent(util.get_scroll_base_el(), "scroll", check, "if");
    return check();
  };

  module.exports = {
    init: init
  };


  },{"../ba-postmessage.js":8,"../event.coffee":12,"../util.coffee":22}],27:[function(require,module,exports){
  var doSlide, event, getArticleTop, init, insertCss, isSlidingWidgetCssApplied, simplePostMessage, styleEl, util, widgetScrollEvents, widgetScrollEventsShow, widgetScrollEventsTid;

  util = require('../util.coffee');

  event = require('../event.coffee');

  simplePostMessage = require('../ba-postmessage.js');

  isSlidingWidgetCssApplied = false;

  widgetScrollEvents = {};

  widgetScrollEventsTid = {};

  widgetScrollEventsShow = {};

  insertCss = function(code) {
    var style;
    style = document.createElement('style');
    style.type = 'text/css';
    if (style.styleSheet) {
      style.styleSheet.cssText = code;
    } else {
      style.innerHTML = code;
    }
    return document.getElementsByTagName("head")[0].appendChild(style);
  };

  styleEl = function(el) {
    el.className += " dable-secret-hidden";
    el.style.overflow = "hidden";
    el.style.maxHeight = "0px";
    return el.style.transition = "max-height 1s";
  };

  doSlide = function(el) {
    var f, ref;
    if (el.getAttribute('dable-slided')) {
      return;
    }
    el.setAttribute('dable-slided', '1');
    el.className = el.className.replace(" dable-secret-hidden", "");
    el.style.maxHeight = "1200px";
    f = (ref = el.getElementsByTagName("iframe")) != null ? ref[0] : void 0;
    if (f != null ? f.contentWindow : void 0) {
      return simplePostMessage.postMessage("show_secret_widget", f.getAttribute("src"), f.contentWindow);
    }
  };

  getArticleTop = function(el) {
    while (el = el.parentNode) {
      if (el.getAttribute('itemprop') === 'articleBody') {
        return util.getOffsetY(el);
      }
    }
    return 0;
  };

  init = function(id, arg) {
    var base_offset_top, check, el, enabled, for_article, ref, ref1, ref2, scrolledEnough, top_offset;
    enabled = (ref = arg.enabled) != null ? ref : false, for_article = (ref1 = arg.for_article) != null ? ref1 : false, top_offset = (ref2 = arg.top_offset) != null ? ref2 : 0;
    el = document.getElementById(id);
    if (!enabled) {
      el.style.overflow = "visible";
      return false;
    }
    if (!isSlidingWidgetCssApplied) {
      insertCss(".dable-secret-hidden{height:0!important} .dable-secret-hidden iframe{position:absolute;top:-9999px;left:-9999px}");
      isSlidingWidgetCssApplied = true;
    }
    if (el.getAttribute('data-dable-sliding') === '1') {
      return true;
    }
    el.setAttribute('data-dable-sliding', '1');
    styleEl(el);
    base_offset_top = for_article ? getArticleTop(el) : 0;
    if (widgetScrollEvents["sliding" + id]) {
      event.removeEvent(util.get_scroll_base_el(), "scroll", widgetScrollEvents["sliding" + id]);
    }
    scrolledEnough = false;
    check = function() {
      var wy;
      wy = util.getScrollY();
      if (!scrolledEnough && wy > base_offset_top + 300) {
        scrolledEnough = true;
      }
      if (scrolledEnough && wy <= Number(base_offset_top + top_offset)) {
        doSlide(el);
        event.removeEvent(util.get_scroll_base_el(), "scroll", widgetScrollEvents["sliding" + id]);
      }
      return widgetScrollEventsTid["sliding" + id] = null;
    };
    widgetScrollEvents["sliding" + id] = function() {
      if (widgetScrollEventsTid["sliding" + id]) {
        clearTimeout(widgetScrollEventsTid["sliding" + id]);
      }
      return widgetScrollEventsTid["sliding" + id] = setTimeout(check, 100);
    };
    event.addEvent(util.get_scroll_base_el(), "scroll", widgetScrollEvents["sliding" + id]);
    setInterval(widgetScrollEvents["sliding" + id], 5000);
    check();
    return true;
  };

  module.exports = {
    init: init
  };


  },{"../ba-postmessage.js":8,"../event.coffee":12,"../util.coffee":22}],28:[function(require,module,exports){
  var event, init, isUpDownWidgetCssApplied, showWidget, simplePostMessage, util, widgetScrollEvents, widgetScrollEventsShow, widgetScrollEventsTid;

  util = require('../util.coffee');

  event = require('../event.coffee');

  simplePostMessage = require('../ba-postmessage.js');

  isUpDownWidgetCssApplied = false;

  widgetScrollEvents = {};

  widgetScrollEventsTid = {};

  widgetScrollEventsShow = {};

  showWidget = function(up_el, down_el, direction, use_prev_height) {
    if (use_prev_height == null) {
      use_prev_height = false;
    }
    if (down_el.getAttribute('data-updown-show') === direction) {
      return;
    }
    down_el.setAttribute('data-updown-show', direction);
    if (direction === 'down') {
      down_el.className = down_el.className.replace(" dable-updown-hidden", "");
      if (use_prev_height && util.getElemHeight(up_el)) {
        down_el.style.height = util.getElemHeight(up_el) + "px";
      } else {
        down_el.style.height = "auto";
      }
      if (up_el.className.indexOf("dable-updown-hidden" === -1)) {
        return up_el.className = up_el.className + " dable-updown-hidden";
      }
    } else {
      up_el.className = up_el.className.replace(" dable-updown-hidden", "");
      if (use_prev_height && util.getElemHeight(down_el)) {
        up_el.style.height = util.getElemHeight(down_el) + "px";
      } else {
        up_el.style.height = "auto";
      }
      if (down_el.className.indexOf("dable-updown-hidden" === -1)) {
        return down_el.className = down_el.className + " dable-updown-hidden";
      }
    }
  };

  init = function(opts) {
    var check, down_el, frame_id, link_widget_id, ref, threshold_bottom, threshold_top, up_el, use_prev_height;
    frame_id = opts.frame_id, link_widget_id = opts.link_widget_id, threshold_top = opts.threshold_top, threshold_bottom = opts.threshold_bottom;
    if (!isUpDownWidgetCssApplied) {
      util.insertCss(".dable-updown-hidden{display:none !important;}");
      isUpDownWidgetCssApplied = true;
    }
    down_el = document.getElementById(frame_id);
    up_el = document.createElement("div");
    up_el.id = "dablewidget_" + link_widget_id + "_" + (parseInt(Math.random() * 9999));
    up_el.className = up_el.className + " dable-updown-hidden";
    up_el.style.overflow = "hidden";
    up_el.setAttribute("data-widget_id", link_widget_id);
    if ((ref = down_el.parentNode) != null) {
      ref.insertBefore(up_el, down_el.nextSibling);
    }
    dable('renderWidget', up_el.id);
    use_prev_height = true;
    check = function() {
      var elem_height, elem_offset_height, elem_rel_height, elem_rel_pos_ratio, ref1, scroll_height, viewport_height, visible_widget;
      visible_widget = down_el.getAttribute('data-updown-show') || 'down';
      viewport_height = (ref1 = util.getHeight()) != null ? ref1.viewport : void 0;
      scroll_height = util.getScrollY();
      elem_height = util.getElemHeight(down_el) || util.getElemHeight(up_el);
      elem_offset_height = util.getOffsetY(down_el) || util.getOffsetY(up_el);
      if (!elem_height || !viewport_height) {
        return;
      }
      if (visible_widget === 'down') {
        elem_rel_height = elem_offset_height + elem_height - scroll_height;
      } else {
        elem_rel_height = scroll_height + viewport_height - elem_offset_height;
      }
      elem_rel_pos_ratio = elem_rel_height / viewport_height * 100.0;
      if (visible_widget === 'down' && elem_rel_pos_ratio <= threshold_top) {
        showWidget(up_el, down_el, 'up', use_prev_height);
        use_prev_height = false;
      }
      if (visible_widget === 'up' && elem_rel_pos_ratio <= threshold_bottom) {
        return showWidget(up_el, down_el, 'down');
      }
    };
    widgetScrollEvents["updown" + frame_id] = function() {
      if (widgetScrollEventsTid["updown" + frame_id]) {
        clearTimeout(widgetScrollEventsTid["updown" + frame_id]);
      }
      return widgetScrollEventsTid["updown" + frame_id] = setTimeout(check, 100);
    };
    event.addEvent(util.get_scroll_base_el(), "scroll", widgetScrollEvents["updown" + frame_id]);
    setInterval(widgetScrollEvents["updown" + frame_id], 5000);
    check();
    return true;
  };

  module.exports = {
    init: init
  };


  },{"../ba-postmessage.js":8,"../event.coffee":12,"../util.coffee":22}],29:[function(require,module,exports){
  var CommandQueue, Executor, i, item, len, q, ref, util;

  if ((ref = window.dable) != null ? ref.plugin_loaded : void 0) {
    return;
  }

  CommandQueue = require('./lib/CommandQueue.coffee');

  Executor = require('./lib/Executor.coffee');

  util = require('./lib/util.coffee');

  if (/(MSIE 6|Firefox\/33)/.test(window.navigator.userAgent)) {
    return;
  }

  if (util.readParam('dable_newsroom')) {
    util.includeScript((util.protocol()) + "//static.dable.io/dist/newsroom.min.js");
  }

  if (window.dable == null) {
    window.dable = function() {
      if (dable.q == null) {
        dable.q = [];
      }
      return dable.q.push(arguments);
    };
  }

  q = window.dable.q || [];

  if (!util.isArray(q)) {
    return;
  }

  window.dable.q = new CommandQueue(new Executor());

  for (i = 0, len = q.length; i < len; i++) {
    item = q[i];
    window.dable.q.push(item);
  }

  window.dable.plugin_loaded = true;


  },{"./lib/CommandQueue.coffee":1,"./lib/Executor.coffee":2,"./lib/util.coffee":22}],30:[function(require,module,exports){
  var JSON = (this && this.JSON) || function () {

    function f(n) {    // Format integers to have at least two digits.
      return n < 10 ? '0' + n : n;
    }

    Date.prototype.toJSON = function () {
      return this.getUTCFullYear()   + '-' +
        f(this.getUTCMonth() + 1) + '-' +
        f(this.getUTCDate())      + 'T' +
        f(this.getUTCHours())     + ':' +
        f(this.getUTCMinutes())   + ':' +
        f(this.getUTCSeconds())   + 'Z';
    };


    var m = {    // table of character substitutions
      '\b': '\\b',
      '\t': '\\t',
      '\n': '\\n',
      '\f': '\\f',
      '\r': '\\r',
      '"' : '\\"',
      '\\': '\\\\'
    };

    function stringify(value, whitelist) {
      var a,          // The array holding the partial texts.
      i,          // The loop counter.
      k,          // The member key.
      l,          // Length.
      r = /["\\\x00-\x1f\x7f-\x9f]/g,
      v;          // The member value.

      switch (typeof value) {
        case 'string':

          return r.test(value) ?
          '"' + value.replace(r, function (a) {
            var c = m[a];
            if (c) {
              return c;
            }
            c = a.charCodeAt();
            return '\\u00' + Math.floor(c / 16).toString(16) +
              (c % 16).toString(16);
          }) + '"' :
          '"' + value + '"';

        case 'number':

          return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':
          return String(value);

        case 'object':

          if (!value) {
            return 'null';
          }

          if (typeof value.toJSON === 'function') {
            return stringify(value.toJSON());
          }
          a = [];
          if (typeof value.length === 'number' &&
            !(value.propertyIsEnumerable('length'))) {

              l = value.length;
              for (i = 0; i < l; i += 1) {
                a.push(stringify(value[i], whitelist) || 'null');
              }

              return '[' + a.join(',') + ']';
            }
            if (whitelist) {
              l = whitelist.length;
              for (i = 0; i < l; i += 1) {
                k = whitelist[i];
                if (typeof k === 'string') {
                  v = stringify(value[k], whitelist);
                  if (v) {
                    a.push(stringify(k) + ':' + v);
                  }
                }
              }
            } else {

              for (k in value) {
                if (typeof k === 'string') {
                  v = stringify(value[k], whitelist);
                  if (v) {
                    a.push(stringify(k) + ':' + v);
                  }
                }
              }
            }

            return '{' + a.join(',') + '}';
      }
    }

    return {
      stringify: stringify,
      parse: function (text, filter) {
        var j;

        function walk(k, v) {
          var i, n;
          if (v && typeof v === 'object') {
            for (i in v) {
              if (Object.prototype.hasOwnProperty.apply(v, [i])) {
                n = walk(i, v[i]);
                if (n !== undefined) {
                  v[i] = n;
                } else {
                  delete v[i];
                }
              }
            }
          }
          return filter(k, v);
        }
        if (/^[\],:{}\s]*$/.test(text.replace(/\\["\\\/bfnrtu]/g, '@').
        replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
        replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

          j = eval('(' + text + ')');

          return typeof filter === 'function' ? walk('', j) : j;
        }

        throw new SyntaxError('parseJSON');
      }
    };
  }();

  module.exports = JSON;

  },{}],31:[function(require,module,exports){
  var JSON = require('./JSON');

  var crc32Object = function(obj) {
    var sortObj = function (o) {
      var a = [],i;
      for(i in o) {
        if(!o.hasOwnProperty(i)) continue;
        a.push([i, (function() {
          if (o[i] && typeof o[i] == 'object' && o[i].constructor != Array)
            return (o[i].constructor == Object) && sortObj(o[i]) || (o[i].constructor == Date) && o[i].toJSON() || o[i].toString();
          else if (typeof o[i] == 'function')
            return o[i].toString();
          else return o[i];
        })()]);
      }
      return a.sort(function(a,b){ return a[0]>b[0]?1:-1;});
    };
    var str = JSON.stringify(sortObj(obj));
    var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";
    var crc = 0xFFFFFFFF, y=0;
    for (var i = 0, iTop = str.length; i < iTop; i++) {
      y = ( crc ^ str.charCodeAt(i)) & 0xFF;
      crc = ( crc >>> 8 ) ^ "0x" + table.substr((y<<3)+y ,8);;
    }
    crc = (crc ^ 0xFFFFFFFF);
    return  (crc<0 && (0xFFFFFFFF+crc+ 1) || crc).toString(16);
  };

  module.exports = crc32Object;

  },{"./JSON":30}]},{},[29]);
   })();
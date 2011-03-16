/**
 * @class
 * Roster Management
 *
 * @extends XC.Base
 * @extends XC.Mixin.HandlerRegistration
 * @extends XC.Mixin.RosterX.Service
 *
 * @see <a href="http://www.ietf.org/rfc/rfc3921.txt">RFC 3921: XMPP IM; Section 7 & 8</a>
 */
XC.Service.Roster = XC.Base.extend(XC.Mixin.RosterX.Service,
                                   XC.Mixin.HandlerRegistration,
  /** @lends XC.Service.Roster# */{

  /**
   * <p>The current version of the roster.</p>
   *
   * <p>If you have a current known version that you are
   * working off of, set the ver attribute here to let
   * the server know in subsequent requests what version
   * it should base its response off of.</p>
   *
   * <p>When a new version of the roster is received, this
   * attribute will be updated to reflect the new version
   * that you have</p>
   * @type String
   * @see <a href="http://xmpp.org/extensions/xep-0237.html">XEP-0237: Roster Versioning</a>
   */
  ver: null,

  /**
   * Register for incoming stanzas
   *
   * @param {Function} $super The parent init function.
   * @private
   */
  init: function ($super) {
    if (XC.isFunction($super)) {
      $super.apply(this, Array.from(arguments).slice(1));
    }

    if (this.connection) {
      this.connection.registerStanzaHandler({
        element: 'iq',
        xmlns: XC.Registrar.Roster.XMLNS
      }, this._handleRosterItems, this);
    }

    return this;
  }.around(),

  /**
   * Request your roster from the server.
   *
   * @param {Object} [callbacks]
   *    An Object with 'onError' and 'onSuccess'.
   *   @param {Function} [callbacks.onError]
   *      A function taking a stanza as a parameter.
   *     @param {XC.PacketAdapter} [callbacks.onError#packet]
   *        The packet passed into XC.
   *   @param {Function} [callbacks.onSuccess]
   *      A function taking a list of entities.
   *     @param {XC.Entity[]} [callbacks.onSuccess#entities]
   *        A list of entities retrieved from your roster.
   */
  requestItems: function (callbacks) {
    var iq = XC.XML.XMPP.IQ.extend(),
        q = XC.XML.XMPP.Query.extend({xmlns: XC.Registrar.Roster.XMLNS});
    iq.type('get');
    iq.addChild(q);
    if (this.ver !== null && typeof this.ver !== "undefined") {
      q.attr('ver', this.ver);
    }

    this.connection.send(iq.toString(), this._rosterRequestResponse.bind(this, callbacks));
  },

  /**
   * Called on a roster request IQ response.
   *
   * @param {Object} callbacks The callbacks to call when a successful request was made.
   * @param {XC.Packet} packet The resulting packet.
   */
  _rosterRequestResponse: function (callbacks, packet) {
    if (packet.getType() === 'error' &&
        callbacks && callbacks.onError &&
        XC.isFunction(callbacks.onError)) {
      callbacks.onError(packet);
    } else {
      packet = packet.getNode();
      var query = packet.getElementsByTagName('query'),
          items = packet.getElementsByTagName('item'),
          entities = [], itemsLength = items.length;

      // Update the version tag.
      if (query.length) {
        query = query[0];
        this.ver = query.getAttribute('ver');
      }

      for (var i = 0; i < itemsLength; i++) {
        entities.push(this._entityFromItem(items[i]));
      }

      if (callbacks && callbacks.onSuccess &&
          XC.isFunction(callbacks.onSuccess)) {
        callbacks.onSuccess(entities);
      }
    }
  },

  /**
   * Call {@link this.registerHandler} with "onRosterItems" to register
   * for incoming roster items.
   * @name XC.Service.Roster#onRosterItems
   * @event
   * @param {XC.Entity[]} entities A list of entities pushed by the server.
   */

  /**
   * Handle incoming out-of-band Roster IQs
   *
   * @private
   * @param {XC.PacketAdapter} packet The incoming XML stanza.
   */
  _handleRosterItems: function (packet) {
    var type = packet.getType();
    packet = packet.getNode();

    // Acknowledge a roster push.
    if (type === 'set') {
      var iq = XC.XML.XMPP.IQ.extend();
      iq.type('result');
      iq.attr('id', packet.getAttribute('id'));
      this.connection.send(iq.toString());
    }

    // Process the items passed from the roster.
    var query = packet.getElementsByTagName('query'),
        items = packet.getElementsByTagName('item'),
        itemsLength = items.length, entities = [];

    // Update the version tag.
    if (query.length) {
      query = query[0];
      this.ver = query.getAttribute('ver');
    }

    for (var i = 0; i < itemsLength; i++) {
      entities.push(this._entityFromItem(items[i]));
    }
    this.fireHandler('onRosterItems', entities);
  },

  /**
   * Construct an {@link XC.Entity} from a XML fragment from a Roster IQ.
   *
   * @private
   * @param {Element} item A node that contains info about a roster item.
   */
  _entityFromItem: function (item) {
    var entity = this.connection.Entity.extend({
      jid: item.getAttribute('jid'),
      roster: {
        subscription: item.getAttribute('subscription'),
        ask: item.getAttribute('ask'),
        name: item.getAttribute('name'),
        groups: []
      }
    });

    var groups = item.getElementsByTagName('group');
    for (var j = 0, len = groups.length; j < len; j++) {
      entity.roster.groups.push(XC_DOMHelper.getTextContent(groups[j]));
    }
    return entity;
  }

});

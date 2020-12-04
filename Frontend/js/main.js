const BastionBox = window.BastionBox || {};

$(document).ready(() => {
  if (!checkAuthenticated()) window.location.href = '/index.html';

  BastionBox.token = localStorage.getItem('bastionBoxAccessToken');
  $.ajaxSetup({
    beforeSend: (xhr) => {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Access-Token', BastionBox.token);
    },
    error: function (xhr, status, err) {
      if (xhr.status === 401) { window.location.href = '/index.html'; }
    }
  });

  BastionBox.VPNConfigs = [];
  BastionBox.ConsoleConnections = [];
  list();

  $('#logoutBtn').on('click', (event) => {
    logout();
  });

  $('#consoleConnectionModal').on('show.bs.modal', (event) => {
    resetConnectionModal();
  });

  $('#vpnConfigModal').on('show.bs.modal', (event) => {
    resetVPNModal();
  });

  $('#createVpnConfigBtn').on('click', () => {
    createVpnConfig();
  });

  $('#createConsoleConnectionBtn').on('click', () => {
    createConsoleConnection();
  });

  $('#connModalDelete').on('click', () => {
    deleteConsoleConnection();
  });

  $('#consoleProtoSelect input[type="radio"]').on('click', (event) => {
    updateProtoDisplay(event);
  });

  $('#vncSftpCheck').on('change', (event) => {
    updateVncSftpDisplay(event);
  });
});

function createConsoleConnection () {
  const conn = {};
  const id = $('#createConsoleConnectionBtn').attr('data-conn-id');
  if (id) conn.ID = id;
  conn.Name = $('#consoleNameInput').val();
  conn.Host = $('#consoleHostInput').val();
  conn.Protocol = $('input[name="protoRadios"]:checked').val();
  if (conn.Protocol === 'RDP') {
    const username = $('#rdpUsernameInput').val();
    if (username !== '') conn.Username = username;
    const domain = $('#rdpDomainInput').val();
    if (domain !== '') conn.Domain = domain;
    const password = $('#rdpPasswordInput').val();
    if (password !== '') conn.Password = password;
    if ($('#rdpNlaCheck').prop('checked')) conn.NLA = true;
    conn.Port = $('#rdpPortInput').val();
  } else if (conn.Protocol === 'SSH') {
    const username = $('#sshUsernameInput').val();
    if (username !== '') conn.Username = username;
    const password = $('#sshPasswordInput').val();
    if (password !== '') conn.Password = password;
    const key = $('#sshKeyInput').val();
    if (key !== '') conn.Key = key;
    conn.Port = $('#sshPortInput').val();
  } else if (conn.Protocol === 'VNC') {
    const username = $('#vncUsernameInput').val();
    if (username !== '') conn.Username = username;
    const password = $('#vncPasswordInput').val();
    if (password !== '') conn.Password = password;
    conn.Port = $('#vncPortInput').val();
    if ($('#vncSftpCheck').prop('checked')) {
      conn.SFTP = {};
      const username = $('#vncSftpUsernameInput').val();
      if (username !== '') conn.SFTP.Username = username;
      const password = $('#vncSftpPasswordInput').val();
      if (password !== '') conn.SFTP.Password = password;
      const key = $('#vncSftpKeyInput').val();
      if (key !== '') conn.SFTP.Key = key;
      conn.SFTP.Port = $('#vncSftpPortInput').val();
    }
  }
  const postData = JSON.stringify(conn);
  $.post(
    '/api/createconnection', postData, (data) => {
      if (data.result === 'success') {
        if (conn.ID) {
          BastionBox.ConsoleConnections = BastionBox.ConsoleConnections.map((c) => c.ID !== conn.ID ? c : data.conn);
        } else {
          BastionBox.ConsoleConnections.push(data.conn);
        }
        drawConnectionList();
      } else {
        window.bootbox.alert('Failed to create new console connection');
      }
    }
  );
}

function resetVPNModal () {
  $('#vpnConfigModal input[type="text"]').val('');
  $('#linuxRadio').prop('checked', true);
}

function resetConnectionModal () {
  $('#consoleConnectionModal input[type="text"]').val('');
  $('#consoleConnectionModal textarea').val('');
  $('#rdpPortInput').val(3389);
  $('#sshPortInput').val(22);
  $('#vncPortInput').val(5900);
  $('#vncSftpPortInput').val(22);

  $('#rdpRadio').prop('checked', true);
  $('#rdpNlaCheck').prop('checked', false);
  $('#consoleRDPOptions').show();
  $('#consoleSSHOptions').hide();
  $('#consoleVNCOptions').hide();
  $('#vncSftpCheck').prop('checked', false);
  $('#vncSftpOptions').hide();

  $('#connModalDelete').hide();
  $('#connModalDelete').removeAttr('data-conn-id');
  $('#createConsoleConnectionBtn').removeAttr('data-conn-id');
  $('#createConsoleConnectionBtn').text('Create');
  $('#connModalTitle').text('New Console Connection');
}

function updateVncSftpDisplay (e) {
  if ($(e.target).is(':checked')) {
    $('#vncSftpOptions').show();
  } else {
    $('#vncSftpOptions').hide();
  }
}

function updateProtoDisplay (e) {
  const proto = $(e.target).val();
  switch (proto) {
    case 'RDP':
      $('#consoleRDPOptions').show();
      $('#consoleSSHOptions').hide();
      $('#consoleVNCOptions').hide();
      break;
    case 'SSH':
      $('#consoleRDPOptions').hide();
      $('#consoleSSHOptions').show();
      $('#consoleVNCOptions').hide();
      break;
    case 'VNC':
      $('#consoleRDPOptions').hide();
      $('#consoleSSHOptions').hide();
      $('#consoleVNCOptions').show();
      break;
  }
}

function logout () {
  localStorage.clear();
  window.location.href = '/index.html';
}

function checkAuthenticated () {
  const token = localStorage.getItem('bastionBoxAccessToken');
  if (token) {
    try {
      const jwt = window.jwt_decode(token);
      if (jwt.exp > Math.floor(Date.now() / 1000)) {
        $('#navbarUsername').text(htmlEncode(jwt.username));
        return true;
      }
    } catch (error) {
      return false;
    }
  }
  return false;
}

function drawConfigList () {
  $('#vpnTableBody').empty();
  BastionBox.VPNConfigs.forEach((config) => {
    const filename = `${config.Name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}.ovpn`;

    $('#vpnTableBody').append(`<tr><td>${window.htmlEncode(config.Name)}</td>
      <td>${config.Type}</td>
      <td><a href="data:text/plain;charset=utf-8,${encodeURIComponent(config.Data)}" download="${filename}" class="btn vpn-download"><span class="fas fa-download" aria-hidden="true"></span></a></td>
      <td><a href="#" class="btn revoke" data-conf-id="${config.ID}"><span class="fas fa-minus-circle" aria-hidden="true"></span></a></td></tr>`);
  });

  $('.revoke').off('click');
  $('.revoke').on('click', (event) => {
    const id = $(event.currentTarget).attr('data-conf-id');
    revokeVpnConfig(id);
  });
}

function drawConnectionList () {
  $('#consoleTableBody').empty();
  BastionBox.ConsoleConnections.forEach((conn) => {
    $('#consoleTableBody').append(`<tr><td>${window.htmlEncode(conn.Name || '')}</td>
      <td>${window.htmlEncode(conn.Host)}</td>
      <td>${conn.Protocol}</td>
      <td>${window.htmlEncode(conn.Username || '')}</td>
      <td><i data-placement="bottom" data-original-title="Console" class="fas ${conn.Protocol === 'SSH' ? 'fa-terminal' : 'fa-desktop'} terminal" data-conn-id="${conn.ID}"></i></td>
      <td><a href="#" class="btn edit-conn" data-conn-id="${conn.ID}"><span class="fas fa-wrench" aria-hidden="true"></span></a></td></tr>`);
  });

  $('.terminal').off('click');
  $('.terminal').on('click', (event) => {
    const id = $(event.currentTarget).attr('data-conn-id');
    const win = window.open();
    launchConsole(id, win);
  });

  $('.edit-conn').off('click');
  $('.edit-conn').on('click', (event) => {
    const id = $(event.currentTarget).attr('data-conn-id');
    editConnection(id);
  });
}

function editConnection (connId) {
  resetConnectionModal();
  const conn = BastionBox.ConsoleConnections.find((c) => c.ID === connId);
  $('#consoleConnectionModal').modal('show');
  $('#connModalDelete').show();
  $('#connModalDelete').attr('data-conn-id', connId);
  $('#createConsoleConnectionBtn').attr('data-conn-id', connId);
  $('#createConsoleConnectionBtn').text('Save');
  $('#connModalTitle').text('Edit Console Connection');

  $('#consoleNameInput').val(conn.Name);
  $('#consoleHostInput').val(conn.Host);
  $('input[name="protoRadios"]:checked').val(conn.Protocol);
  if (conn.Protocol === 'RDP') {
    $('#rdpRadio').prop('checked', true);
    $('#consoleRDPOptions').show();
    $('#consoleSSHOptions').hide();
    $('#consoleVNCOptions').hide();
    if (conn.Username) $('#rdpUsernameInput').val(conn.Username);
    if (conn.Domain) $('#rdpDomainInput').val(conn.Domain);
    if (conn.Password) $('#rdpPasswordInput').val(conn.Password);
    if (conn.NLA) $('#rdpNlaCheck').prop('checked', true);
    if (conn.Port) $('#rdpPortInput').val(conn.Port);
  } else if (conn.Protocol === 'SSH') {
    $('#sshRadio').prop('checked', true);
    $('#consoleRDPOptions').hide();
    $('#consoleSSHOptions').show();
    $('#consoleVNCOptions').hide();
    if (conn.Username) $('#sshUsernameInput').val(conn.Username);
    if (conn.Password) $('#sshPasswordInput').val(conn.Password);
    if (conn.Key) $('#sshKeyInput').val(conn.Key);
    if (conn.Port) $('#sshPortInput').val(conn.Port);
  } else if (conn.Protocol === 'VNC') {
    $('#vncRadio').prop('checked', true);
    $('#consoleRDPOptions').hide();
    $('#consoleSSHOptions').hide();
    $('#consoleVNCOptions').show();
    if (conn.Username) $('#vncUsernameInput').val(conn.Username);
    if (conn.Password) $('#vncPasswordInput').val(conn.Password);
    if (conn.Port) $('#vncPortInput').val(conn.Port);
    if (conn.SFTP) {
      $('#vncSftpCheck').prop('checked', true);
      $('#vncSftpOptions').show();
      if (conn.SFTP.Username) $('#vncSftpUsernameInput').val(conn.SFTP.Username);
      if (conn.SFTP.Password) $('#vncSftpPasswordInput').val(conn.SFTP.Password);
      if (conn.SFTP.Key) $('#vncSftpKeyInput').val(conn.SFTP.Key);
      if (conn.SFTP.Port) $('#vncSftpPortInput').val(conn.SFTP.Port);
    }
  }
}

function list () {
  $.get(
    '/api/list', (data) => {
      if (data.result === 'success') {
        BastionBox.VPNConfigs = data.configs;
        BastionBox.ConsoleConnections = data.connections;
        drawConfigList();
        drawConnectionList();
      } else {
        console.log('Could not retrieve connection and config lists');
      }
    }
  );
}

function launchConsole (connId, win) {
  const jsonData = {
    id: connId
  };
  const postData = JSON.stringify(jsonData);
  $.post('/api/connect', postData, (data) => {
    if (data.result === 'success') {
      win.location = data.url;
    } else {
      win.close();
      window.bootbox.alert(`Error: ${data.message}`);
    }
  });
}

function createVpnConfig () {
  const name = $('#configNameInput').val();
  if (name === '') {
    window.bootbox.alert('Please enter a certificate name.');
    return;
  }
  const type = $('input[name="osRadios"]:checked').val();
  const jsonData = {
    type,
    name
  };
  const postData = JSON.stringify(jsonData);
  $.post(
    '/api/createvpnconfig', postData, (data) => {
      if (data.result === 'success') {
        BastionBox.VPNConfigs.push(data.config);
        drawConfigList();
      } else {
        window.bootbox.alert('Failed to create new vpn config');
      }
    }
  );
}

function revokeVpnConfig (id) {
  const jsonData = {
    id
  };
  const postData = JSON.stringify(jsonData);
  $.post(
    '/api/revokevpnconfig', postData, (data) => {
      if (data.result === 'success') {
        BastionBox.VPNConfigs = BastionBox.VPNConfigs.filter((c) => c.ID !== id);
        drawConfigList();
      } else {
        window.bootbox.alert('Failed to revoke vpn config');
      }
    }
  );
}

function deleteConsoleConnection () {
  const id = $('#connModalDelete').attr('data-conn-id');
  const jsonData = {
    id
  };
  const postData = JSON.stringify(jsonData);
  $.post(
    '/api/deleteconnection', postData, (data) => {
      if (data.result === 'success') {
        BastionBox.ConsoleConnections = BastionBox.ConsoleConnections.filter((c) => c.ID !== id);
        drawConnectionList();
      } else {
        window.bootbox.alert('Failed to delete connection');
      }
    }
  );
}

function htmlEncode (value) {
  return $('<textarea/>').text(value).html();
}

/* eslint-disable */
/* jwt-decode */
/* Copyright (c) 2015 Auth0, Inc. <support@auth0.com> (http://auth0.com) */

/* https://github.com/auth0/jwt-decode/blob/master/build/jwt-decode.min.js */
/* MIT License */

!function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);var j=new Error("Cannot find module '"+g+"'");throw j.code="MODULE_NOT_FOUND",j}var k=c[g]={exports:{}};b[g][0].call(k.exports,function(a){var c=b[g][1][a];return e(c?c:a)},k,k.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(a,b,c){function d(a){this.message=a}function e(a){var b=String(a).replace(/=+$/,"");if(b.length%4==1)throw new d("'atob' failed: The string to be decoded is not correctly encoded.");for(var c,e,g=0,h=0,i="";e=b.charAt(h++);~e&&(c=g%4?64*c+e:e,g++%4)?i+=String.fromCharCode(255&c>>(-2*g&6)):0)e=f.indexOf(e);return i}var f="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";d.prototype=new Error,d.prototype.name="InvalidCharacterError",b.exports="undefined"!=typeof window&&window.atob&&window.atob.bind(window)||e},{}],2:[function(a,b,c){function d(a){return decodeURIComponent(e(a).replace(/(.)/g,function(a,b){var c=b.charCodeAt(0).toString(16).toUpperCase();return c.length<2&&(c="0"+c),"%"+c}))}var e=a("./atob");b.exports=function(a){var b=a.replace(/-/g,"+").replace(/_/g,"/");switch(b.length%4){case 0:break;case 2:b+="==";break;case 3:b+="=";break;default:throw"Illegal base64url string!"}try{return d(b)}catch(c){return e(b)}}},{"./atob":1}],3:[function(a,b,c){"use strict";function d(a){this.message=a}var e=a("./base64_url_decode");d.prototype=new Error,d.prototype.name="InvalidTokenError",b.exports=function(a,b){if("string"!=typeof a)throw new d("Invalid token specified");b=b||{};var c=b.header===!0?0:1;try{return JSON.parse(e(a.split(".")[c]))}catch(f){throw new d("Invalid token specified: "+f.message)}},b.exports.InvalidTokenError=d},{"./base64_url_decode":2}],4:[function(a,b,c){(function(b){var c=a("./lib/index");"function"==typeof b.window.define&&b.window.define.amd?b.window.define("jwt_decode",function(){return c}):b.window&&(b.window.jwt_decode=c)}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"./lib/index":3}]},{},[4]);

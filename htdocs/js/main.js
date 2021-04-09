require.config({
	waitSeconds: 60,
	shim: {
		'bootstrap': {
			deps: [
				'jquery'
			]
		}
	},
	paths: {
		jquery: 'https://ajax.aspnetcdn.com/ajax/jQuery/jquery-2.1.4.min',
		bootstrap: 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/js/bootstrap.min',
		CodeMirror: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.4.0',
		// CDNJS uses weird paths. Need this hack to allow loading CM addons
		// which references a nonexistant "../../lib/codemirror".
		'CodeMirror/lib/codemirror': 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.4.0/codemirror.min'
	}
});

require([
	'jquery',
	'Preview',
	'Editor',
	'Clairnote_2_18',
	'Clairnote_2_19',
        'hymn_includes',
	'bootstrap'
], function(
	$,
	Preview,
	Editor,
	clairnoteLyString_2_18,
	clairnoteLyString_2_19,
        hymnIncludes
) {
	$(function() {
		var STAGE = 'https://7icpm9qr6a.execute-api.us-west-2.amazonaws.com/prod/';
		var score = {};
		var currentPage = window.location.pathname.slice(1);
		score.id = currentPage.split('/')[0] || '';

		var capitalized = { unstable: 'Unstable', stable: 'Stable' };
		$('#version_sel a').click(function() {
			var state = this.dataset.version;
			$('#version_btn')
				.data('state', state)
				.html(capitalized[state] +
					' <span class="caret"></span>');
			loadPreview();
		});

		$.get('https://s3-us-west-2.amazonaws.com/lilybin-tarballs/versions.json', function(data) {
			$('#version_sel a[data-version="stable"]')  .append(' (' + data.stable   + ')');
			$('#version_sel a[data-version="unstable"]').append(' (' + data.unstable + ')');
		});

		function removeComments(ly) {
			var comments = /(%{(.|\n)*%}|%.*)/g;
			return ly.replace(comments, '');
		};

                function includeHymnSinger(ly, clairnoteLyString) {
                    window.record = []
                    regex = new RegExp("\\\\include \"(?:\.\.\/\.\.\/lib\/)?([0-9a-z_]*)\.ly\"", "g")
                    match = regex.exec(ly)
                    var i = 0;
                    while (match != null && i < 20) {
                        i += 1;
                        console.log(match);
                        file_base = match[1]
                        ly = ly.replace(match[0], hymnIncludes[file_base]);
                        console.log(ly.substring(0,100));
                        regex.lastIndex = 0; // Resets the regex
                        match = regex.exec(ly)
                    }
                    window.ly = ly;
                    return ly
                }

		function loadPreview() {
			var version = $('#version_btn').data('state');
			var clairnoteLyString = version === 'unstable'
				? clairnoteLyString_2_19
				: clairnoteLyString_2_18;

			preview.load({
				code: includeHymnSinger(removeComments(editor.getValue()), clairnoteLyString),
				version: version
			}, function (err, response) {
				if (err) return;
				$('#preview_button').attr('disabled', true);
			});
		}

		function save() {
			score.code = editor.getValue();
			score.version = $('#version_btn').data('state');
			$.post('/save', score, function(response) {
				window.history.pushState({}, '', '/' + response.id + '/' + response.revision);
				score.id = response.id;
				preview.id = response.id;
				editor.spinner.hide();
				preview.load(score, function (err, response) {
					if (err) return;
					$('#preview_button').attr('disabled', true);
				});
			}, 'json');
		}

		function changed() {
			// Disable saving to LilyBin for now.
			// $('#preview_button, #save_button').attr('disabled', false);
			$('#preview_button').attr('disabled', false);
		}

		var editor = new Editor($('#code_container'));
		editor.event.bind({ 'preview': loadPreview,
		                    'save'   : save,
		                    'change' : changed });

		// Disable saving to LilyBin for now.
		// if (score.id) $('#save_button').attr('disabled', true);

		var mainHeight = $(window).height() - $('#header').outerHeight();
		var mainWidth  = $(window).width();
		// Corresponds with Bootstrap's xs
		var xs = mainWidth < 768;

		$('a.noop').click(function (e) {
			e.preventDefault();
		});

		var preview = window.p = new Preview($('#preview_container'), score.id);
		preview.event.bind('scroll', function(e, lineInfo) {
			// textedit:///path/to/file:1:2:3 <-- column
			//                          ^ ^
			//                          | +------ char
			//                          +-------- line
			// char   = number of character in this line **before** the
			//          character that led to the note (key).
			// column = 1 + 8 * (number of tabs before the key) +
			//          (number of non-tab characters before the key)
			//        = char + 1 + 7 * (number of tabs before the key)
			var line = lineInfo.line;
			var char = lineInfo.char;

			editor.focus();
			editor.scrollTo(line, char + 1);
		});

		var codeContainer = $('#code_container, .CodeMirror, .CodeMirror-gutters')
			.css({height: (xs ? mainHeight * (5/12) : mainHeight) + 'px'});
		var previewContainer = $('#preview_container')
			.css({height: (xs ? mainHeight * (7/12) : mainHeight) + 'px'});
		preview.resize();

		var timer;
		$(window).resize(function() {
			if (timer) clearTimeout(timer);

			timer = setTimeout(function() {
				var mainHeight = $(window).height() - $('#header').outerHeight();
				var mainWidth  = $(window).width();
				// Corresponds with Bootstrap's xs
				var xs = mainWidth < 768;

				codeContainer
					.css({height: (xs ? mainHeight * (5/12) : mainHeight) + 'px'});
				previewContainer
					.css({height: (xs ? mainHeight * (7/12) : mainHeight) + 'px'});
				preview.resize();
			}, 200);
		});

		$('#preview_button').click(loadPreview);

		// Disable saving to LilyBin for now.
		// $('#save_button').click(editor.save.bind(editor));

		$('#reset_button').click(editor.reset.bind(editor));
		$('#undo_button').click(editor.undo.bind(editor));
		$('#redo_button').click(editor.redo.bind(editor));

		/* // Disable dropbox for now
		$('#open_from_dropbox').click(function() {
			Dropbox.choose({
				success: function(files) {
					var link = files[0].link;
					editor.spinner.show();
					$.get(link).done(function(code) {
						score.code = code;
						editor.openFile(code, !!code);
					}).fail(function(err) {
						var errorMessage = 'While fetching file from Dropbbox:\n\n';
						if (err.responseJSON && err.responseJSON.err) {
							errorMessage += err.responseJSON.err;
						} else {
							errorMessage += err.statusText;
						}
						preview.handleResponse({error: errorMessage});
					}).always(function() {
						editor.spinner.hide();
					})
				},
				linkType: 'direct',
				multiselect: false
			});
		});

		$('#save_to_dropbox').click(function() {
			editor.spinner.show();
			$.post(STAGE + '/save_temp', JSON.stringify({
				code: editor.getValue(),
			}), function(response) {
				editor.spinner.hide();
				preview.error.hide();
				if (!response.id) {
					var errorMessage = 'Error while uploading score:\n\n' + JSON.stringify(response, null, 2);
					preview.handleResponse({
						error: errorMessage
					});
				}
				var url = 'https://s3-us-west-2.amazonaws.com/lilybin-source-files/' + response.id + '.ly';
				var $modal = $('#save_modal').modal('show');
				$('#save_modal_ok').click(function(e) {
					$(this).off('click');
					$modal.modal('hide')
					Dropbox.save(url, $('#file_name').val(), {
						success: function() {},
						error: function(errorMsg) {
							preview.handleResponse({
								error: 'Error while saving to Dropbox:\n' + errorMsg
							});
						}
					});
				});
			}, 'json').fail(function(err) {
				var errorMessage = 'Error while uploading score:\n\n';
				if (err.responseJSON && err.responseJSON.err) {
					errorMessage += err.responseJSON.err;
				} else {
					errorMessage += err.statusText;
				}
				preview.handleResponse({
					error: errorMessage
				});
			});

		});
		*/

		$.get('/api/' + currentPage).done(function(data) {
			score.version = data.version;
			$('#version_btn').data('state', data.version);
			$('#version_btn')
				.html(capitalized[data.version] +
					' <span class="caret"></span>');

			score.code    = data.code;
			editor.openFile(data.code, !!data.code);
		}).fail(function(err) {
			var errorMessage;
			if (err.responseJSON && err.responseJSON.err) {
				errorMessage = err.responseJSON.err;
			} else {
				errorMessage = err.statusText;
			}
			preview.handleResponse({error: errorMessage});
			$('#preview_button')     .off('click');
			// Disable saving to LilyBin for now.
			// $('#save_button')        .off('click');
			$('#version_sel a')      .off('click');
		})

		// Tooltips are weird-behaving on touch screen devices.
		// Simply disable them.
		if (window.innerWidth >= 992 ||
			!('ontouchstart' in window) &&
			(!window.DocumentTouch || !(document instanceof DocumentTouch))) {
			$('[data-toggle="tooltip"]').tooltip({ html: true, placement: 'bottom' });
		}
		$('#save_modal').modal({show: false});
	});
});

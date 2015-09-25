window.TouchUI = window.TouchUI || {};
window.TouchUI.scroll = {
	
	iScrolls: {},

	beforeLoad: function() {
		var self = this;
		
		// Manipulate DOM for iScroll before knockout binding kicks in
		if (!window.TouchUI.isTouch) {
			$('<div id="scroll"></div>').insertBefore('.page-container');
			$('.page-container').appendTo("#scroll");
		}
		
		// Create iScroll container for terminal anyway, we got styling on that
		var cont = $('<div id="terminal-scroll"></div>').insertBefore("#terminal-output");
		$("#terminal-output").appendTo(cont);
	},
	init: function() {
		var self = this;

		// Hide topbar if clicking an item 
		// Notice: Use delegation in order to trigger the event after the tab content has changed, other click events fire before.
		// TODO: Make this a setting in the options
		$(document).on("click", '#tabs [data-toggle="tab"]', function() {
			window.TouchUI.scroll.iScrolls.body.refresh();
			window.TouchUI.animate.hide("navbar");
		});

		// Add body scrolling on mousedown if there is no touch events 
		// Setup mouse as touch
		if (!window.TouchUI.isTouch) { 
			
			// Set overflow hidden for best performance
			$("html").addClass("hasScrollTouch");
			
			self.terminal.init.call(self);
			self.body.init.call(self);
			
			// Try to bind inputs, textareas and buttons to keyup rather then mousedown
			// Not on selects since we can't cancel the preventDefault
			$('input, textarea, button').on("mousedown", function(e) {
				e.preventDefault();
				
				var scrolled = false;
				self.iScrolls.body.on("scrollStart", function(event) {
					scrolled = true;
				});
				
				$(document).on("mouseup", function(event) {
					
					if(!scrolled && $(event.target).parents($(e.delegateTarget)).length > 0) {
						$(e.delegateTarget).focus().addClass('touch-focus').animate({opacity:1}, 300, function() {
							$(e.delegateTarget).removeClass('touch-focus');
						});
					}
					
					$(document).off(event);
					self.iScrolls.body.off("scrollStart");
				});
				
			});

		}

	},
		
	body: {
		
		init: function() {
			var self = this;

			// Create main body scroll
			self.iScrolls.body = new IScroll("#scroll", {
				scrollbars: true,
				mouseWheel: true,
				interactiveScrollbars: true,
				shrinkScrollbars: "scale",
				fadeScrollbars: true
			});
			
			// Prevent dropdowns from closing when scrolling with them
			$(document).on("mousedown", function(e) {
				
				// Add CSS pointer-events: none; to block all JS events
				self.iScrolls.body.on("scrollStart", function() {
					if( $(e.target).parents(".dropdown-menu").length > 0 ) {
						setTimeout(function() {
							$(e.target).parents(".dropdown-menu").addClass("no-pointer");
						}, 50);
					}
				});
				
				// Add CSS pointer-events: all; to renable all JS events
				self.iScrolls.body.on("scrollEnd", function() {
					$(e.target).parents(".dropdown-menu").removeClass("no-pointer");
					
					// Remove the events
					self.iScrolls.body.off("scrollStart");
					self.iScrolls.body.off("scrollEnd");
					
					// Refresh body scroll
					self.iScrolls.body.refresh();
				});
			});

		}		
	},
	
	terminal: {
		
		init: function() {
			var self = this;
			
			// Create scrolling for terminal
			self.iScrolls.terminal = new IScroll("#terminal-scroll", {
				scrollbars: true,
				mouseWheel: true,
				interactiveScrollbars: true,
				shrinkScrollbars: "scale",
				fadeScrollbars: true
			});
			
			// Enforce the right scrollheight and disable main scrolling if we have a scrolling content
			self.iScrolls.terminal.on("beforeScrollStart", function() {
				self.iScrolls.terminal.refresh();
				
				if(this.hasVerticalScroll) {
					self.iScrolls.body.disable();
				}
			});
			self.iScrolls.terminal.on("scrollEnd", function() {
				self.iScrolls.body.enable();
			});

		},

		knockoutOverwrite: function(terminalViewModel) {
				
			//Setup scroll events in modal
			window.TouchUI.scroll.modal.init.call(window.TouchUI.scroll.modal);
			
			// Refresh terminal scroll height
			terminalViewModel.displayedLines.subscribe(function() {
				window.TouchUI.scroll.iScrolls.terminal.refresh();
			});
			
			// Overwrite scrollToEnd function with iScroll functions
			terminalViewModel.scrollToEnd = function() {
				window.TouchUI.scroll.iScrolls.terminal.refresh();
				window.TouchUI.scroll.iScrolls.terminal.scrollTo(0, window.TouchUI.scroll.iScrolls.terminal.maxScrollY);
			};
		
			// Overwrite orginal helper, add one step and call the orginal function
			var showOfflineOverlay = window.showOfflineOverlay;
			window.showOfflineOverlay = function(title, message, reconnectCallback) {
				window.TouchUI.scroll.iScrolls.body.scrollTo(0, 0, 500);
				showOfflineOverlay.call(this, title, message, reconnectCallback);
			};
			
			// Overwrite orginal helper, add one step and call the orginal function
			var showConfirmationDialog = window.showConfirmationDialog;
			window.showConfirmationDialog = function(message, onacknowledge) {
				window.TouchUI.scroll.iScrolls.body.scrollTo(0, 0, 500);
				showConfirmationDialog.call(this, message, onacknowledge);
			};
			
			// Well this is easier, isn't it :D
			$("#reloadui_overlay").on("show", function() {
				window.TouchUI.scroll.iScrolls.body.scrollTo(0, 0, 500);
			});
		}
	},
	
	modal: {
		modals: [],
		modalDropdown: null,
		init: function() {
			var $document = $(document),
				self = this;
			
			$document.on("show.modalmanager", function(e) {
				var $modalElm = $(e.target);
				console.log(e);

				if( typeof $modalElm.data("modal") !== "object" ) {
					//assume we are switching tabs
					return;
				}
				
				// Create temp iScroll within the modal
				self.modals.push(new IScroll($modalElm.parent()[0], {
					scrollbars: true,
					mouseWheel: true,
					interactiveScrollbars: true,
					shrinkScrollbars: "scale"
				}));
				
				var curModal = self.modals[self.modals.length-1];
				
				// Ugly, force iScroll to get the correct scrollHeight
				setTimeout(function() {
					curModal.refresh();
				}, 0);
			
				// Disable all JS events while scrolling for best performance
				var tmp = false;
				curModal.on("scrollStart", function() {
					$modalElm.addClass("no-pointer");
				});
				curModal.on("scrollEnd scrollCancel", function(e) {
					if(tmp !== false) {
						clearTimeout(tmp);
					}
				
					tmp = setTimeout(function() {
						$modalElm.removeClass("no-pointer");
						tmp = false;
					}, 300);
				});
				
				// Prevent default events (i.e. clones) refresh the scrollHeight and scroll back to top
				$modalElm.find('[data-toggle="tab"]').on("click", function(e) {
					e.preventDefault();
					curModal.stop();
					
					setTimeout(function() {
						curModal.refresh();
						curModal.scrollTo(0, 0);
					}, 0);
				});
				
				$modalElm.one("destroy", function() {
					$modalElm.find('[data-toggle="tab"]').off("click");
					curModal.destroy();
					self.modals.pop();
				});
				
			});
				
			// Triggered when we create the dropdown and need scrolling
			$document.on("dropdown-is-open", function(e, elm) {

				// Create dropdown scroll
				self.modalDropdown = new IScroll(elm, {
					scrollbars: true,
					mouseWheel: true,
					interactiveScrollbars: true,
					shrinkScrollbars: "scale"
				});
				
				// Set scroll to active item
				self.modalDropdown.scrollToElement($(elm).find('li.active')[0], 0, 0, -30);
				
				// Disable scrolling in active modal
				self.modals[self.modals.length-1].disable();
				
				// Disable all JS events for smooth scrolling
				var tmp2 = false;
				self.modalDropdown.on("scrollStart", function(e) {
					$(elm).addClass("no-pointer");
				});
				self.modalDropdown.on("scrollEnd scrollCancel", function(e) {
					if(tmp2 !== false) {
						clearTimeout(tmp2);
					}
				
					tmp2 = setTimeout(function() {
						$(elm).removeClass("no-pointer");
					}, 300);
				});
			});
			
			$document.on("dropdown-is-closed", function() {
				// Enable active modal
				self.modals[self.modals.length-1].enable();
				self.modalDropdown.destroy();
			});
			
		}
	}
};
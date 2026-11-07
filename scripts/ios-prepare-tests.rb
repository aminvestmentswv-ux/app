require 'xcodeproj'
project_path = Dir['ios/*.xcodeproj'].first or abort 'No app project'
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |t| t.product_type == 'com.apple.product-type.application' } or abort 'No app target'
test = project.new_target(:ui_test_bundle, 'AMNativeUITests', :ios, '16.4')
test.add_dependency(app)
project.root_object.attributes['TargetAttributes'] ||= {}
project.root_object.attributes['TargetAttributes'][test.uuid] = { 'TestTargetID' => app.uuid }
test.build_configurations.each do |config|
  config.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.aminvestments.nativeqatest.uitests',
    'GENERATE_INFOPLIST_FILE' => 'YES', 'SWIFT_VERSION' => '5.0',
    'TEST_TARGET_NAME' => app.name, 'CODE_SIGNING_ALLOWED' => 'NO',
    'IPHONEOS_DEPLOYMENT_TARGET' => '16.4', 'TARGETED_DEVICE_FAMILY' => '1,2'
  })
end
['ios-native-tests.swift', 'ios-test-config.swift'].each do |name|
  ref = project.main_group.new_file(File.expand_path("scripts/#{name}"))
  test.source_build_phase.add_file_reference(ref)
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(test)
scheme.set_launch_target(app)
scheme.test_action.build_configuration = 'Release'
scheme.launch_action.build_configuration = 'Release'
scheme.save_as(project_path, 'AMNativeQA', true)

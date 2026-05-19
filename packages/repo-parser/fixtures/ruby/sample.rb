require 'json'
require_relative 'helper'

class SampleRuby
  def initialize(name)
    @name = name
  end

  def greet
    puts "Hello, #{@name}"
  end
end
